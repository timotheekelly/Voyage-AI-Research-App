package com.example.research.service;

import com.example.research.config.IngestionProperties;
import com.example.research.config.MongoConfig;
import com.example.research.config.RetrievalProperties;
import com.example.research.exception.ApiException;
import com.example.research.model.DocumentChunk;
import com.example.research.model.ProcessingStatus;
import com.example.research.model.ResearchDocument;
import com.example.research.repository.DocumentRepository;
import com.example.research.retrieval.AtlasChunkSearch;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Decides when a PROCESSING document becomes READY.
 *
 * <p>Atlas exposes no per-document "embedded" status API; the documented internals (a generated collection in
 * __mdb_internal_search) are explicitly not for application use. Readiness is therefore defined by what matters to the
 * user: an exact vector search filtered to this document must return ALL of its chunks, which can only happen once
 * Atlas has embedded and indexed every one. This uses only the documented $vectorSearch stage. Each probe embeds one
 * short query string at query time, so keep the poll interval modest on rate-limited tiers (M0: 3 requests/minute).
 *
 * <p>A document that is not queryable within app.ingestion.readiness-timeout is marked FAILED with a reason, so it
 * never appears READY or stays PROCESSING forever. State lives in MongoDB, so this also recovers after a restart.
 */
@Component
public class ReadinessMonitor {

    private static final Logger log = LoggerFactory.getLogger(ReadinessMonitor.class);

    private final DocumentRepository documents;
    private final MongoTemplate mongo;
    private final AtlasChunkSearch search;
    private final RetrievalProperties retrieval;
    private final IngestionProperties ingestion;
    private final Clock clock;

    public ReadinessMonitor(DocumentRepository documents, MongoTemplate mongo, AtlasChunkSearch search,
                            RetrievalProperties retrieval, IngestionProperties ingestion, Clock clock) {
        this.documents = documents;
        this.mongo = mongo;
        this.search = search;
        this.retrieval = retrieval;
        this.ingestion = ingestion;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${app.ingestion.readiness-poll-interval:20s}", initialDelayString = "${app.ingestion.readiness-poll-interval:20s}")
    public void checkProcessingDocuments() {
        for (ResearchDocument doc : documents.findByProcessingStatus(ProcessingStatus.PROCESSING)) {
            try {
                check(doc);
            } catch (RuntimeException e) {
                log.warn("Readiness check for document {} failed: {}", doc.id(), e.getMessage());
            }
        }
    }

    void check(ResearchDocument doc) {
        Instant now = Instant.now(clock);
        Duration timeout = ingestion.readinessTimeout();
        if (doc.chunksStoredAt() == null) {
            // Still extracting, or the app stopped mid-ingestion.
            if (doc.uploadedAt().plus(timeout).isBefore(now)) markFailed(doc, "Ingestion did not complete.");
            return;
        }
        String lastProblem = null;
        try {
            String probe = doc.title() == null || doc.title().isBlank() ? "document" : doc.title();
            if (search.allChunksQueryable(retrieval.defaultConfiguration().indexName(), doc.id(), doc.chunkCount(), probe)) {
                mongo.updateMulti(Query.query(Criteria.where("documentId").is(doc.id())),
                        new Update().set("ready", true), DocumentChunk.class);
                documents.save(doc.withStatus(ProcessingStatus.READY, null));
                log.info("Document {} is READY ({} chunks queryable)", doc.id(), doc.chunkCount());
                return;
            }
        } catch (ApiException e) {
            lastProblem = e.getMessage();
        }
        if (doc.chunksStoredAt().plus(timeout).isBefore(now)) {
            markFailed(doc, "Embeddings were not queryable within " + timeout.toMinutes() + " minutes."
                    + (lastProblem == null ? "" : " Last check: " + lastProblem));
        }
    }

    private void markFailed(ResearchDocument doc, String reason) {
        mongo.remove(Query.query(Criteria.where("documentId").is(doc.id())), MongoConfig.CHUNKS);
        documents.save(doc.withStatus(ProcessingStatus.FAILED, reason));
        log.warn("Document {} marked FAILED: {}", doc.id(), reason);
    }
}
