package com.example.research.evaluation;

import com.example.research.dto.request.OptimizationDto;
import com.example.research.model.RetrievalEvaluation;
import com.example.research.model.RetrievalEvaluation.Aggregate;
import com.example.research.model.RetrievalEvaluation.Case;
import com.example.research.model.RetrievalEvaluation.CaseResult;
import com.example.research.model.RetrievalEvaluation.EvaluationStatus;
import com.example.research.repository.EvaluationRepository;
import com.example.research.retrieval.OptimizedRetrievalService;
import com.example.research.retrieval.RetrievalOutcome;
import com.example.research.retrieval.RetrievedChunk;
import com.example.research.service.WorkspaceService;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/** Runs an evaluation on the bounded evaluation executor so it never blocks chat requests. Retrieval only, no LLM. */
@Component
public class EvaluationRunner {

    private static final Logger log = LoggerFactory.getLogger(EvaluationRunner.class);

    private final EvaluationRepository evaluations;
    private final OptimizedRetrievalService retrieval;
    private final WorkspaceService workspaces;
    private final Clock clock;

    public EvaluationRunner(EvaluationRepository evaluations, OptimizedRetrievalService retrieval,
                            WorkspaceService workspaces, Clock clock) {
        this.evaluations = evaluations;
        this.retrieval = retrieval;
        this.workspaces = workspaces;
        this.clock = clock;
    }

    @Async("evaluationExecutor")
    public void run(String evaluationId) {
        RetrievalEvaluation eval = evaluations.findById(evaluationId).orElse(null);
        if (eval == null) return;
        eval = evaluations.save(copy(eval, EvaluationStatus.RUNNING, List.of(), null, null, Instant.now(clock), null));
        try {
            // Re-check access at run time: membership may have changed since the run was queued.
            List<String> scope = workspaces.resolveScope(eval.createdBy(), eval.workspaceId(), false);
            var cfg = eval.configuration();
            List<CaseResult> results = new ArrayList<>();
            for (Case c : eval.cases()) {
                results.add(evaluateCase(c, scope, cfg));
            }
            Aggregate aggregate = aggregate(results);
            EvaluationStatus status = aggregate.evaluatedCases() == 0 ? EvaluationStatus.FAILED : EvaluationStatus.COMPLETED;
            String reason = status == EvaluationStatus.FAILED ? "Every case failed; see per-case errors." : null;
            evaluations.save(copy(eval, status, results, aggregate, reason, eval.startedAt(), Instant.now(clock)));
        } catch (RuntimeException e) {
            log.error("Evaluation {} failed", evaluationId, e);
            evaluations.save(copy(eval, EvaluationStatus.FAILED, List.of(), null,
                    e instanceof com.example.research.exception.ApiException ? e.getMessage() : "The evaluation failed unexpectedly.",
                    eval.startedAt(), Instant.now(clock)));
        }
    }

    private CaseResult evaluateCase(Case c, List<String> scope, RetrievalEvaluation.Configuration cfg) {
        try {
            long start = System.nanoTime();
            RetrievalOutcome outcome = retrieval.retrieve(c.question(), scope, cfg.strategy(), cfg.reranking(), cfg.filters(),
                    new OptimizationDto(cfg.embeddingConfiguration(), null, false));
            double latencyMs = (System.nanoTime() - start) / 1_000_000.0;
            List<String> chunkIds = outcome.passages().stream().map(RetrievedChunk::chunkId).toList();
            List<String> docIds = outcome.passages().stream().map(RetrievedChunk::documentId).toList();
            return new CaseResult(c.question(), chunkIds, docIds,
                    RetrievalMetrics.recallAtK(c.expectedDocumentIds(), c.expectedChunkIds(), chunkIds, docIds, cfg.k()),
                    RetrievalMetrics.reciprocalRank(c.expectedDocumentIds(), c.expectedChunkIds(), chunkIds, docIds),
                    latencyMs, null);
        } catch (RuntimeException e) {
            log.warn("Evaluation case failed: {}", e.getMessage());
            return new CaseResult(c.question(), List.of(), List.of(), null, null, null,
                    e instanceof com.example.research.exception.ApiException ? e.getMessage() : "Retrieval failed.");
        }
    }

    /** Aggregates only over cases that ran; failed cases are counted separately, never scored as zero. */
    static Aggregate aggregate(List<CaseResult> results) {
        List<CaseResult> ok = results.stream().filter(r -> r.error() == null).toList();
        if (ok.isEmpty()) return new Aggregate(0, results.size(), null, null, null, null);
        List<Double> latencies = ok.stream().map(CaseResult::latencyMs).toList();
        return new Aggregate(ok.size(), results.size() - ok.size(),
                RetrievalMetrics.mean(ok.stream().map(CaseResult::recallAtK).toList()),
                RetrievalMetrics.mean(ok.stream().map(CaseResult::reciprocalRank).toList()),
                RetrievalMetrics.mean(latencies), RetrievalMetrics.percentile(latencies, 95));
    }

    private static RetrievalEvaluation copy(RetrievalEvaluation e, EvaluationStatus status, List<CaseResult> results,
                                            Aggregate aggregate, String failure, Instant started, Instant completed) {
        return new RetrievalEvaluation(e.id(), e.name(), e.createdBy(), e.workspaceId(), status, e.configuration(), e.cases(),
                results, aggregate, failure, e.createdAt(), started, completed);
    }
}
