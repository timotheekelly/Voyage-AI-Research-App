package com.example.research.evaluation;

import com.example.research.dto.request.EvaluationRequest;
import com.example.research.exception.ApiException;
import com.example.research.model.RetrievalEvaluation;
import com.example.research.model.RetrievalEvaluation.Case;
import com.example.research.model.RetrievalEvaluation.EvaluationStatus;
import com.example.research.repository.EvaluationRepository;
import com.example.research.retrieval.OptimizedRetrievalService;
import com.example.research.retrieval.RetrievalRequestResolver;
import com.example.research.service.Ids;
import com.example.research.service.WorkspaceService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;

/** Creates, validates and reads evaluation runs. Execution is delegated to {@link EvaluationRunner}. */
@Service
public class EvaluationService {

    private final EvaluationRepository evaluations;
    private final EvaluationRunner runner;
    private final WorkspaceService workspaces;
    private final RetrievalRequestResolver resolver;
    private final OptimizedRetrievalService optimized;
    private final Clock clock;

    public EvaluationService(EvaluationRepository evaluations, EvaluationRunner runner, WorkspaceService workspaces,
                             RetrievalRequestResolver resolver, OptimizedRetrievalService optimized, Clock clock) {
        this.evaluations = evaluations;
        this.runner = runner;
        this.workspaces = workspaces;
        this.resolver = resolver;
        this.optimized = optimized;
        this.clock = clock;
    }

    public RetrievalEvaluation submit(String userId, EvaluationRequest request) {
        workspaces.requireMember(request.workspaceId(), userId);
        var reranking = resolver.reranking(request.reranking());
        resolver.filters(request.filters());
        var configuration = optimized.resolveConfiguration(request.embeddingConfiguration(), null);

        List<Case> cases = request.cases().stream().map(c -> {
            List<String> docs = c.expectedDocumentIds() == null ? List.of() : c.expectedDocumentIds();
            List<String> chunks = c.expectedChunkIds() == null ? List.of() : c.expectedChunkIds();
            if (docs.isEmpty() && chunks.isEmpty()) {
                throw ApiException.badRequest("Every case needs at least one expectedDocumentIds or expectedChunkIds entry.");
            }
            return new Case(c.question(), docs, chunks);
        }).toList();

        var cfg = new RetrievalEvaluation.Configuration(resolver.strategy(request.retrievalStrategy()), request.reranking(),
                request.filters(), configuration.id(), reranking.finalResultCount());
        RetrievalEvaluation saved = evaluations.save(new RetrievalEvaluation(Ids.newId("evaluation"), request.name().strip(),
                userId, request.workspaceId(), EvaluationStatus.PENDING, cfg, cases, List.of(), null, null,
                Instant.now(clock), null, null));
        try {
            runner.run(saved.id());
        } catch (TaskRejectedException e) {
            evaluations.deleteById(saved.id());
            throw ApiException.unavailable("EVALUATION_BUSY", "Too many evaluations are queued. Try again later.", e);
        }
        return saved;
    }

    public RetrievalEvaluation get(String userId, String id) {
        RetrievalEvaluation e = evaluations.findById(id).orElseThrow(() -> ApiException.notFound("Evaluation"));
        if (!e.createdBy().equals(userId)) throw ApiException.forbidden("You do not have access to this evaluation.");
        return e;
    }

    public List<RetrievalEvaluation> list(String userId) {
        return evaluations.findByCreatedByOrderByCreatedAtDesc(userId);
    }
}
