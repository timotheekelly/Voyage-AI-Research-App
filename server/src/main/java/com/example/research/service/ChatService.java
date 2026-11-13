package com.example.research.service;

import com.example.research.dto.response.ChatResponse;
import com.example.research.dto.response.Citation;
import com.example.research.dto.response.DiagnosticsInfo;
import com.example.research.dto.response.RetrievalInfo;
import com.example.research.exception.ApiException;
import com.example.research.model.Conversation;
import com.example.research.model.ResearchDocument;
import com.example.research.repository.DocumentRepository;
import com.example.research.retrieval.RetrievalOutcome;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Chat orchestration shared by all five API versions: authorize, retrieve (version-specific, supplied by the
 * controller), generate, verify citations, persist. Nothing is persisted and no answer is invented if a step fails.
 */
@Service
public class ChatService {

    static final String INSUFFICIENT_CONTEXT =
            "I couldn't find anything in the documents available to you that answers this question, so I can't answer it reliably.";

    public record Request(String userId, String conversationId, String workspaceId, String question,
                          boolean allowAllWorkspaces, boolean diagnostics) {}

    private final WorkspaceService workspaces;
    private final ConversationService conversations;
    private final DocumentRepository documents;
    private final AnswerGenerationService answers;
    private final CitationService citations;

    public ChatService(WorkspaceService workspaces, ConversationService conversations, DocumentRepository documents,
                       AnswerGenerationService answers, CitationService citations) {
        this.workspaces = workspaces;
        this.conversations = conversations;
        this.documents = documents;
        this.answers = answers;
        this.citations = citations;
    }

    /** @param retrieval runs the version's retrieval over the authorized workspace ids */
    public ChatResponse chat(Request req, Function<List<String>, RetrievalOutcome> retrieval) {
        long start = System.nanoTime();

        List<String> scope = workspaces.resolveScope(req.userId(), req.workspaceId(), req.allowAllWorkspaces());
        Conversation conversation = null;
        if (req.conversationId() != null && !req.conversationId().isBlank()) {
            conversation = conversations.requireOwned(req.userId(), req.conversationId());
            if (req.workspaceId() != null && conversation.workspaceId() != null
                    && !conversation.workspaceId().equals(req.workspaceId())) {
                throw ApiException.badRequest("This conversation belongs to a different workspace.");
            }
        }

        RetrievalOutcome outcome = retrieval.apply(scope);

        String answer;
        List<Citation> verified = List.of();
        Long generationMs = null;
        if (outcome.passages().isEmpty()) {
            answer = INSUFFICIENT_CONTEXT; // nothing retrieved: a fixed notice, not a model-written answer
        } else {
            Map<String, String> titles = titlesFor(outcome);
            long genStart = System.nanoTime();
            String raw = answers.generate(req.question(), outcome.passages(), titles);
            generationMs = (System.nanoTime() - genStart) / 1_000_000;
            CitationService.Resolved resolved = citations.resolve(raw, outcome.passages(), titles);
            answer = resolved.answer();
            verified = resolved.citations();
        }

        String workspaceForConversation = req.workspaceId() != null ? req.workspaceId()
                : (conversation != null ? conversation.workspaceId() : (scope.size() == 1 ? scope.get(0) : null));
        Conversation saved = conversations.saveExchange(req.userId(), conversation, workspaceForConversation,
                req.question(), answer, verified);

        RetrievalInfo info = new RetrievalInfo(outcome.strategy(), outcome.rerankingEnabled(), outcome.candidateCount(),
                outcome.passages().size());
        DiagnosticsInfo diagnostics = !req.diagnostics() ? null : new DiagnosticsInfo(
                outcome.retrievalMillis(), null, generationMs, (System.nanoTime() - start) / 1_000_000,
                outcome.candidateCount(), outcome.passages().size(), outcome.strategy().value());
        return new ChatResponse(saved.id(), answer, verified, info, diagnostics);
    }

    private Map<String, String> titlesFor(RetrievalOutcome outcome) {
        var ids = outcome.passages().stream().map(p -> p.documentId()).distinct().toList();
        Map<String, String> titles = new HashMap<>();
        for (ResearchDocument d : documents.findAllById(ids)) titles.put(d.id(), d.title());
        return titles.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }
}
