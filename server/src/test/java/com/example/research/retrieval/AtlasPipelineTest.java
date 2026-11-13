package com.example.research.retrieval;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.FiltersDto;
import com.example.research.model.RetrievalStrategy;
import java.time.Duration;
import java.util.List;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.Test;

/** Verifies the generated aggregation pipelines without needing Atlas. */
class AtlasPipelineTest {

    private final RetrievalProperties props = new RetrievalProperties(30, 5, 1000, "chunk_text_index", "content", 10,
            "rerank-2.5", 1.0, 1.0, Duration.ofSeconds(30),
            List.of(new RetrievalProperties.Configuration("default", "d", "chunk_vector_index", "voyage-4", "none", false, false, "")));
    private final AtlasChunkSearch search = new AtlasChunkSearch(null, props, null);

    private static List<Document> docs(List<Bson> pipeline) {
        return pipeline.stream().map(b -> (Document) b).toList();
    }

    private static RetrievalQuery query(RetrievalStrategy s, boolean rerank, FiltersDto f) {
        return new RetrievalQuery("reactor AP1000", List.of("ws-1", "ws-2"), s, rerank, f, 30, 5, "chunk_vector_index");
    }

    @Test
    void vectorUsesAutoEmbedQueryTextAndAuthorizesInsideTheStage() {
        List<Document> p = docs(search.buildPipeline(query(RetrievalStrategy.VECTOR, false, null)));
        Document vs = p.get(0).get("$vectorSearch", Document.class);
        assertThat(vs.getString("index")).isEqualTo("chunk_vector_index");
        assertThat(vs.getString("path")).isEqualTo("content");
        assertThat(vs.getString("query")).isEqualTo("reactor AP1000"); // text, not a precomputed vector
        assertThat(vs.getInteger("limit")).isEqualTo(30);
        assertThat(vs.getInteger("numCandidates")).isEqualTo(300);
        assertThat(vs.get("queryVector")).isNull();
        assertThat(vs.get("filter", Document.class).toJson())
                .contains("\"workspaceId\": {\"$in\": [\"ws-1\", \"ws-2\"]}").contains("\"ready\": true");
        assertThat(p).noneMatch(d -> d.containsKey("$match")); // no post-filtering
    }

    @Test
    void textUsesSearchWithLexicalOperatorAndFilterClauses() {
        List<Document> p = docs(search.buildPipeline(query(RetrievalStrategy.TEXT, false, null)));
        Document s = p.get(0).get("$search", Document.class);
        assertThat(s.getString("index")).isEqualTo("chunk_text_index");
        String json = s.toJson();
        assertThat(json).contains("\"text\": {\"query\": \"reactor AP1000\", \"path\": \"content\"}")
                .contains("\"in\": {\"path\": \"workspaceId\", \"value\": [\"ws-1\", \"ws-2\"]}");
        assertThat(p.get(1)).containsEntry("$limit", 30);
        assertThat(p.toString()).contains("searchScore");
    }

    @Test
    void hybridIsNativeRankFusionOverBothPipelinesEachScoped() {
        List<Document> p = docs(search.buildPipeline(query(RetrievalStrategy.HYBRID, false, null)));
        Document fusion = p.get(0).get("$rankFusion", Document.class);
        Document pipelines = fusion.get("input", Document.class).get("pipelines", Document.class);
        assertThat(pipelines.keySet()).containsExactly("vector", "text");
        String json = pipelines.toJson();
        assertThat(json).contains("$vectorSearch").contains("$search");
        assertThat(json.split("\"workspaceId\"", -1).length - 1).isEqualTo(2); // scoped in BOTH input pipelines
        assertThat(fusion.get("combination", Document.class).get("weights", Document.class).keySet()).containsExactly("vector", "text");
        assertThat(p.toString()).doesNotContain("$rerank");
    }

    @Test
    void rerankRunsAfterTheFirstStageNotInsideRankFusion() {
        List<Document> p = docs(search.buildPipeline(query(RetrievalStrategy.HYBRID, true, null)));
        int fusion = indexOfStage(p, "$rankFusion");
        int rerank = indexOfStage(p, "$rerank");
        assertThat(rerank).isGreaterThan(fusion);
        Document rr = p.get(rerank).get("$rerank", Document.class);
        assertThat(rr.get("query", Document.class).getString("text")).isEqualTo("reactor AP1000");
        assertThat(rr.getString("path")).isEqualTo("content");
        assertThat(rr.getInteger("numDocsToRerank")).isEqualTo(30);
        assertThat(rr.getString("model")).isEqualTo("rerank-2.5");
        assertThat(p.get(0).get("$rankFusion", Document.class).toJson()).doesNotContain("$rerank");
    }

    @Test
    void metadataFiltersAreAppliedInsideEveryRetrievalStage() {
        var filters = new FiltersDto(new FiltersDto.YearRange(2020, 2026), List.of("academic-paper"), List.of("energy"));
        String vector = docs(search.buildPipeline(query(RetrievalStrategy.VECTOR, false, filters))).get(0).toJson();
        assertThat(vector).contains("\"publicationYear\": {\"$gte\": 2020, \"$lte\": 2026}")
                .contains("\"documentType\": {\"$in\": [\"academic-paper\"]}")
                .contains("\"tags\": {\"$in\": [\"energy\"]}");

        String text = docs(search.buildPipeline(query(RetrievalStrategy.TEXT, false, filters))).get(0).toJson();
        assertThat(text).contains("\"range\": {\"path\": \"publicationYear\", \"gte\": 2020, \"lte\": 2026}")
                .contains("\"in\": {\"path\": \"documentType\", \"value\": [\"academic-paper\"]}")
                .contains("\"in\": {\"path\": \"tags\", \"value\": [\"energy\"]}");

        String hybrid = docs(search.buildPipeline(query(RetrievalStrategy.HYBRID, false, filters))).get(0).toJson();
        assertThat(hybrid.split("\"documentType\"", -1).length - 1).isEqualTo(2);
    }

    @Test
    void openEndedYearRangeOnlyEmitsTheBoundGiven() {
        var filters = new FiltersDto(new FiltersDto.YearRange(2022, null), null, null);
        String vector = docs(search.buildPipeline(query(RetrievalStrategy.VECTOR, false, filters))).get(0).toJson();
        assertThat(vector).contains("\"publicationYear\": {\"$gte\": 2022}").doesNotContain("$lte");
    }

    private static int indexOfStage(List<Document> pipeline, String stage) {
        for (int i = 0; i < pipeline.size(); i++) if (pipeline.get(i).containsKey(stage)) return i;
        return -1;
    }
}
