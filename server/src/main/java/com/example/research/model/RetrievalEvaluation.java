package com.example.research.model;

import com.example.research.dto.request.FiltersDto;
import com.example.research.dto.request.RerankingDto;
import java.time.Instant;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** An offline evaluation run: labelled questions, the configuration under test, and per-case and aggregate results. */
@Document("retrieval_evaluations")
@CompoundIndex(name = "owner_created", def = "{'createdBy': 1, 'createdAt': -1}")
public record RetrievalEvaluation(
        @Id String id,
        String name,
        String createdBy,
        String workspaceId,
        EvaluationStatus status,
        Configuration configuration,
        List<Case> cases,
        List<CaseResult> results,
        Aggregate aggregate,
        String failureReason,
        Instant createdAt,
        Instant startedAt,
        Instant completedAt) {

    public enum EvaluationStatus { PENDING, RUNNING, COMPLETED, FAILED }

    public record Configuration(
            RetrievalStrategy strategy,
            RerankingDto reranking,
            FiltersDto filters,
            String embeddingConfiguration,
            int k) {}

    /** Expected relevance labels: a retrieved chunk is relevant if its chunk id or its document id is listed. */
    public record Case(String question, List<String> expectedDocumentIds, List<String> expectedChunkIds) {}

    public record CaseResult(
            String question,
            List<String> retrievedChunkIds,
            List<String> retrievedDocumentIds,
            Double recallAtK,
            Double reciprocalRank,
            Double latencyMs,
            String error) {}

    public record Aggregate(
            int evaluatedCases,
            int failedCases,
            Double meanRecallAtK,
            Double mrr,
            Double averageLatencyMs,
            Double p95LatencyMs) {}
}
