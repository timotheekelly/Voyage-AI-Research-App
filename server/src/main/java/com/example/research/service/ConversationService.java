package com.example.research.service;

import com.example.research.dto.request.CreateConversationRequest;
import com.example.research.exception.ApiException;
import com.example.research.model.ChatMessage;
import com.example.research.model.Conversation;
import com.example.research.repository.ChatMessageRepository;
import com.example.research.repository.ConversationRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ConversationService {

    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final WorkspaceService workspaces;
    private final Clock clock;

    public ConversationService(ConversationRepository conversations, ChatMessageRepository messages,
                               WorkspaceService workspaces, Clock clock) {
        this.conversations = conversations;
        this.messages = messages;
        this.workspaces = workspaces;
        this.clock = clock;
    }

    public Conversation create(String userId, CreateConversationRequest request) {
        workspaces.requireMember(request.workspaceId(), userId);
        Instant now = Instant.now(clock);
        String title = request.title() == null || request.title().isBlank() ? "New conversation" : request.title().strip();
        return conversations.save(new Conversation(Ids.newId("conversation"), request.workspaceId(), userId, title, now, now));
    }

    public List<Conversation> list(String userId, String workspaceId) {
        if (workspaceId == null || workspaceId.isBlank()) return conversations.findByUserIdOrderByUpdatedAtDesc(userId);
        workspaces.requireMember(workspaceId, userId);
        return conversations.findByUserIdAndWorkspaceIdOrderByUpdatedAtDesc(userId, workspaceId);
    }

    /** Conversations are private to the user who created them. */
    public Conversation requireOwned(String userId, String conversationId) {
        Conversation c = conversations.findById(conversationId).orElseThrow(() -> ApiException.notFound("Conversation"));
        if (!c.userId().equals(userId)) throw ApiException.forbidden("You do not have access to this conversation.");
        return c;
    }

    public List<ChatMessage> messagesOf(String conversationId) {
        return messages.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    public void delete(String userId, String conversationId) {
        requireOwned(userId, conversationId);
        messages.deleteByConversationId(conversationId);
        conversations.deleteById(conversationId);
    }

    /** Persists one question/answer exchange, creating the conversation on first use. */
    public Conversation saveExchange(String userId, Conversation existing, String workspaceId, String question,
                                     String answer, List<com.example.research.dto.response.Citation> citations) {
        Instant now = Instant.now(clock);
        Conversation conversation = existing != null ? existing.touched(now) : new Conversation(
                Ids.newId("conversation"), workspaceId, userId, titleFrom(question), now, now);
        conversations.save(conversation);
        messages.saveAll(List.of(
                new ChatMessage(Ids.newId("message"), conversation.id(), com.example.research.model.MessageRole.USER,
                        question, List.of(), now),
                new ChatMessage(Ids.newId("message"), conversation.id(), com.example.research.model.MessageRole.ASSISTANT,
                        answer, citations, now.plusMillis(1))));
        return conversation;
    }

    private static String titleFrom(String question) {
        String q = question.strip().replaceAll("\\s+", " ");
        return q.length() <= 60 ? q : q.substring(0, 57) + "...";
    }
}
