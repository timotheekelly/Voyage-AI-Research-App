package com.example.research.retrieval;

import com.example.research.config.MongoConfig;
import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.FiltersDto;
import com.example.research.exception.ApiException;
import com.example.research.model.RetrievalStrategy;
import com.mongodb.MongoCommandException;
import java.util.ArrayList;
import java.util.List;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

/**
 * Builds and runs the Atlas aggregation pipelines against document_chunks. This is the only class that knows Atlas
 * stage syntax; the five versioned retrieval services decide WHAT to ask for, this class decides HOW.
 *
 * <p>Pipelines use the MongoDB driver's BSON {@link Document} API because Spring Data MongoDB has no abstraction for
 * $vectorSearch with automated embedding, $rankFusion or $rerank.
 *
 * <ul>
 *   <li>VECTOR: {@code $vectorSearch} with {@code query} = the question text. The index uses automated embedding
 *       (type autoEmbed), so Atlas embeds the query with the index's Voyage model. Documents are embedded by Atlas
 *       when their chunks are inserted; the application never calls the Voyage API itself.</li>
 *   <li>TEXT: {@code $search} (BM25 lexical match on the exact terms).</li>
 *   <li>HYBRID: native {@code $rankFusion} over a vector pipeline and a text pipeline (reciprocal rank fusion).</li>
 *   <li>Optional {@code $rerank} runs AFTER the first stage (Atlas does not allow it inside $rankFusion inputs).</li>
 * </ul>
 * Access control and metadata filters are part of each stage's own filter, so unauthorized chunks are never retrieved.
 */
@Component
public class AtlasChunkSearch {

    private static final Logger log = LoggerFactory.getLogger(AtlasChunkSearch.class);

    private final MongoTemplate mongo;
    private final RetrievalProperties props;
    private final AtlasIndexService indexes;

    public AtlasChunkSearch(MongoTemplate mongo, RetrievalProperties props, AtlasIndexService indexes) {
        this.mongo = mongo;
        this.props = props;
        this.indexes = indexes;
    }

    public RetrievalOutcome search(RetrievalQuery q) {
        if (q.strategy() != RetrievalStrategy.TEXT) indexes.requireQueryable(q.vectorIndex());
        if (q.strategy() != RetrievalStrategy.VECTOR) indexes.requireQueryable(props.textIndex());

        List<Bson> pipeline = buildPipeline(q);
        long start = System.nanoTime();
        List<Document> docs = run(pipeline);
        long millis = (System.nanoTime() - start) / 1_000_000;

        List<RetrievedChunk> candidates = docs.stream().map(AtlasChunkSearch::toChunk).toList();
        List<RetrievedChunk> finalPassages = candidates.subList(0, Math.min(q.finalCount(), candidates.size()));
        return new RetrievalOutcome(List.copyOf(finalPassages), candidates.size(), q.strategy(), q.rerank(), millis);
    }

    public List<Bson> buildPipeline(RetrievalQuery q) {
        List<Bson> pipeline = new ArrayList<>();
        int candidates = q.candidateCount();

        switch (q.strategy()) {
            case VECTOR -> pipeline.add(vectorSearchStage(q));
            case TEXT -> {
                pipeline.add(textSearchStage(q));
                pipeline.add(new Document("$limit", candidates));
            }
            case HYBRID -> {
                Document pipelines = new Document()
                        .append("vector", List.of(vectorSearchStage(q)))
                        .append("text", List.of(textSearchStage(q), new Document("$limit", candidates)));
                pipeline.add(new Document("$rankFusion", new Document()
                        .append("input", new Document("pipelines", pipelines))
                        .append("combination", new Document("weights",
                                new Document("vector", props.vectorWeight()).append("text", props.textWeight())))));
                pipeline.add(new Document("$limit", candidates));
            }
        }

        if (q.rerank()) {
            // $rerank overwrites the "score" metadata with the reranker's relevance score and orders by it.
            pipeline.add(new Document("$rerank", new Document()
                    .append("query", new Document("text", q.question()))
                    .append("path", props.contentPath())
                    .append("numDocsToRerank", candidates)
                    .append("model", props.rerankModel())));
            pipeline.add(new Document("$addFields", new Document("score", new Document("$meta", "score"))));
        } else {
            String meta = switch (q.strategy()) {
                case VECTOR -> "vectorSearchScore";
                case TEXT -> "searchScore";
                case HYBRID -> "score"; // the reciprocal-rank-fusion score
            };
            pipeline.add(new Document("$addFields", new Document("score", new Document("$meta", meta))));
        }

        pipeline.add(new Document("$project", new Document()
                .append("_id", 1).append("documentId", 1).append("workspaceId", 1).append("content", 1)
                .append("pageNumber", 1).append("sectionTitle", 1).append("score", 1)));
        return pipeline;
    }

    /** True once every chunk of a document is queryable through the vector index (see ReadinessMonitor). */
    public boolean allChunksQueryable(String indexName, String documentId, int expectedChunks, String probeText) {
        indexes.requireQueryable(indexName);
        int limit = Math.min(expectedChunks, 10_000);
        // Exact (ENN) search restricted to this document returns exactly the chunks that already have embeddings.
        Document stage = new Document("$vectorSearch", new Document()
                .append("index", indexName).append("path", props.contentPath()).append("query", probeText)
                .append("exact", true).append("limit", limit)
                .append("filter", new Document("documentId", documentId)));
        List<Document> hits = run(List.of(stage, new Document("$project", new Document("_id", 1))));
        return hits.size() >= limit;
    }

    // ---- stage builders ----

    private Document vectorSearchStage(RetrievalQuery q) {
        int numCandidates = (int) Math.min(10_000L, Math.max((long) q.candidateCount(), (long) q.candidateCount() * props.numCandidatesMultiplier()));
        return new Document("$vectorSearch", new Document()
                .append("index", q.vectorIndex())
                .append("path", props.contentPath())
                .append("query", q.question())
                .append("numCandidates", numCandidates)
                .append("limit", q.candidateCount())
                .append("filter", vectorFilter(q)));
    }

    private Document textSearchStage(RetrievalQuery q) {
        Document text = new Document("text", new Document("query", q.question()).append("path", props.contentPath()));
        return new Document("$search", new Document()
                .append("index", props.textIndex())
                .append("compound", new Document()
                        .append("must", List.of(text))
                        .append("filter", searchFilters(q))));
    }

    /** MQL pre-filter for $vectorSearch. Every field here is declared as a "filter" field in the vector index. */
    Document vectorFilter(RetrievalQuery q) {
        List<Document> clauses = new ArrayList<>();
        clauses.add(new Document("ready", true));
        clauses.add(new Document("workspaceId", new Document("$in", q.workspaceIds())));
        FiltersDto f = q.filters();
        if (f != null) {
            if (f.publicationYear() != null) {
                Document range = new Document();
                if (f.publicationYear().min() != null) range.append("$gte", f.publicationYear().min());
                if (f.publicationYear().max() != null) range.append("$lte", f.publicationYear().max());
                if (!range.isEmpty()) clauses.add(new Document("publicationYear", range));
            }
            if (f.documentTypes() != null && !f.documentTypes().isEmpty()) {
                clauses.add(new Document("documentType", new Document("$in", f.documentTypes())));
            }
            if (f.tags() != null && !f.tags().isEmpty()) {
                clauses.add(new Document("tags", new Document("$in", f.tags())));
            }
        }
        return new Document("$and", clauses);
    }

    /** Equivalent filters as Atlas Search operators (token fields use `in`, numbers use `range`). */
    List<Document> searchFilters(RetrievalQuery q) {
        List<Document> clauses = new ArrayList<>();
        clauses.add(new Document("equals", new Document("path", "ready").append("value", true)));
        clauses.add(new Document("in", new Document("path", "workspaceId").append("value", q.workspaceIds())));
        FiltersDto f = q.filters();
        if (f != null) {
            if (f.publicationYear() != null) {
                Document range = new Document("path", "publicationYear");
                if (f.publicationYear().min() != null) range.append("gte", f.publicationYear().min());
                if (f.publicationYear().max() != null) range.append("lte", f.publicationYear().max());
                if (range.size() > 1) clauses.add(new Document("range", range));
            }
            if (f.documentTypes() != null && !f.documentTypes().isEmpty()) {
                clauses.add(new Document("in", new Document("path", "documentType").append("value", f.documentTypes())));
            }
            if (f.tags() != null && !f.tags().isEmpty()) {
                clauses.add(new Document("in", new Document("path", "tags").append("value", f.tags())));
            }
        }
        return clauses;
    }

    // ---- execution and error mapping ----

    private List<Document> run(List<Bson> pipeline) {
        try {
            List<Document> out = new ArrayList<>();
            mongo.getCollection(MongoConfig.CHUNKS).aggregate(pipeline).into(out);
            return out;
        } catch (MongoCommandException e) {
            throw translate(e);
        }
    }

    private ApiException translate(MongoCommandException e) {
        String msg = String.valueOf(e.getErrorMessage());
        log.error("Atlas aggregation failed (code {}): {}", e.getErrorCode(), msg);
        if (msg.contains("$rankFusion")) {
            return ApiException.unavailable("ATLAS_FEATURE_UNAVAILABLE",
                    "Hybrid search needs $rankFusion, which this MongoDB deployment does not support (MongoDB 8.0+ required).", e);
        }
        if (msg.contains("$rerank")) {
            return ApiException.unavailable("ATLAS_FEATURE_UNAVAILABLE",
                    "Native reranking ($rerank) is not available: it needs an Atlas cluster on a supported MongoDB version "
                            + "with Native Reranking enabled in Atlas Project Settings.", e);
        }
        if (e.getErrorCode() == 489 || msg.toLowerCase().contains("embedding")) {
            return ApiException.unavailable("EMBEDDING_UNAVAILABLE",
                    "Atlas could not generate the query embedding (the embedding service may be rate-limited). Try again shortly.", e);
        }
        if (msg.contains("$vectorSearch") || msg.contains("$search") || msg.toLowerCase().contains("index")) {
            return ApiException.unavailable("SEARCH_REJECTED",
                    "Atlas rejected the search query. Check the Atlas index definitions against the atlas/ directory.", e);
        }
        return ApiException.unavailable("RETRIEVAL_FAILED", "The retrieval service is temporarily unavailable.", e);
    }

    private static RetrievedChunk toChunk(Document d) {
        Number score = d.get("score", Number.class);
        return new RetrievedChunk(d.getString("_id"), d.getString("documentId"), d.getString("workspaceId"),
                d.getString("content"), d.getInteger("pageNumber"), d.getString("sectionTitle"),
                score == null ? null : score.doubleValue());
    }
}
