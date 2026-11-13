package com.example.research.dto.response;

import com.example.research.model.ChatMessage;
import com.example.research.model.Conversation;
import com.example.research.model.MessageRole;
import java.time.Instant;
import java.util.List;

public record ConversationResponse(
        String id, String workspaceId, String title, Instant createdAt, Instant updatedAt, List<MessageResponse> messages) {

    public record MessageResponse(String id, MessageRole role, String content, List<Citation> citations, Instant createdAt) {
        static MessageResponse from(ChatMessage m) {
            return new MessageResponse(m.id(), m.role(), m.content(), m.citations(), m.createdAt());
        }
    }

    /** messages is null (omitted) for list responses. */
    public static ConversationResponse summary(Conversation c) {
        return new ConversationResponse(c.id(), c.workspaceId(), c.title(), c.createdAt(), c.updatedAt(), null);
    }

    public static ConversationResponse withMessages(Conversation c, List<ChatMessage> messages) {
        return new ConversationResponse(c.id(), c.workspaceId(), c.title(), c.createdAt(), c.updatedAt(),
                messages.stream().map(MessageResponse::from).toList());
    }
}
