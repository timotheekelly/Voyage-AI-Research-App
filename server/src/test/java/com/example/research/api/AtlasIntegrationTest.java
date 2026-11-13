package com.example.research.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.RerankingDto;
import com.example.research.model.ProcessingStatus;
import com.example.research.model.ResearchWorkspace;
import com.example.research.repository.DocumentRepository;
import com.example.research.repository.WorkspaceRepository;
import com.example.research.retrieval.AtlasIndexService;
import com.example.research.retrieval.FilteredRetrievalService;
import com.example.research.retrieval.HybridRetrievalService;
import com.example.research.retrieval.RerankingRetrievalService;
import com.example.research.retrieval.VectorRetrievalService;
import com.example.research.dto.request.FiltersDto;
import com.example.research.model.RetrievalStrategy;
import com.example.research.service.DocumentService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * End-to-end against a real Atlas deployment. SKIPPED unless ATLAS_TEST_URI is set.
 *
 * <p>Prerequisites (see README): a cluster with automated embedding, the two indexes from atlas/ created on the
 * test database's document_chunks collection, Native Reranking enabled (for the rerank test), and Voyage access.
 * Run: ATLAS_TEST_URI=... ATLAS_TEST_DATABASE=research_it mvn test -Dtest=AtlasIntegrationTest
 * The LLM is not involved; retrieval services are called directly.
 */
@Tag("atlas")
@EnabledIfEnvironmentVariable(named = "ATLAS_TEST_URI", matches = ".+")
@SpringBootTest(properties = {"OPENAI_API_KEY=unused", "MONGODB_URI=unused", "app.ingestion.readiness-poll-interval=10s"})
@ActiveProfiles("test")
class AtlasIntegrationTest {

    @DynamicPropertySource
    static void atlas(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", () -> System.getenv("ATLAS_TEST_URI"));
        registry.add("spring.data.mongodb.database", () -> System.getenv().getOrDefault("ATLAS_TEST_DATABASE", "research_it"));
    }

    @Autowired AtlasIndexService indexes;
    @Autowired RetrievalProperties props;
    @Autowired WorkspaceRepository workspaces;
    @Autowired DocumentRepository documents;
    @Autowired DocumentService documentService;
    @Autowired VectorRetrievalService v1;
    @Autowired HybridRetrievalService v2;
    @Autowired RerankingRetrievalService v3;
    @Autowired FilteredRetrievalService v4;

    private static final String TEXT = """
            The AP1000 is a pressurized water reactor design with passive safety systems.
            Passive cooling removes decay heat without pumps, relying on gravity and natural circulation.
            Separately, solar photovoltaic costs have fallen sharply over the last decade.
            """;

    @Test
    void ingestedDocumentBecomesReadyAndIsRetrievableByEveryStrategy() {
        assertThat(indexes.unavailableReason(props.defaultConfiguration().indexName())).isNull();
        assertThat(indexes.unavailableReason(props.textIndex())).isNull();

        String user = "atlas-it-" + UUID.randomUUID();
        var ws = workspaces.save(new ResearchWorkspace("ws-" + UUID.randomUUID(), "IT", "", user, List.of(user), Instant.now()));
        var doc = documentService.upload(user, ws.id(), new MockMultipartFile("file", "ap1000.txt", "text/plain", TEXT.getBytes()),
                new DocumentService.UploadMetadata("AP1000 notes", "IT", 2024, "report", List.of("nuclear")));

        // READY only after Atlas has embedded every chunk and the vector index can return them.
        await().atMost(Duration.ofMinutes(10)).pollInterval(Duration.ofSeconds(10)).until(() ->
                documents.findById(doc.id()).orElseThrow().processingStatus() == ProcessingStatus.READY);

        List<String> scope = List.of(ws.id());
        assertThat(v1.retrieve("passive safety in pressurized water reactors", scope).passages()).isNotEmpty();
        assertThat(v2.retrieve("AP1000", scope, RetrievalStrategy.TEXT).passages()).isNotEmpty();      // lexical, exact term
        assertThat(v2.retrieve("AP1000", scope, RetrievalStrategy.HYBRID).passages()).isNotEmpty();    // $rankFusion
        assertThat(v4.retrieve("reactor", scope, RetrievalStrategy.HYBRID, null,
                new FiltersDto(new FiltersDto.YearRange(2020, 2026), List.of("report"), List.of("nuclear"))).passages()).isNotEmpty();
        assertThat(v4.retrieve("reactor", scope, RetrievalStrategy.HYBRID, null,
                new FiltersDto(new FiltersDto.YearRange(1990, 1999), null, null)).passages()).isEmpty();
        // another tenant's workspace id returns nothing for the same query
        assertThat(v1.retrieve("AP1000 reactor", List.of("ws-someone-else")).passages()).isEmpty();
        // $rerank needs Native Reranking enabled in Project Settings; this fails with a clear 503 if it is not.
        var reranked = v3.retrieve("passive cooling", scope, RetrievalStrategy.HYBRID, new RerankingDto(true, 10, 2));
        assertThat(reranked.rerankingEnabled()).isTrue();
        assertThat(reranked.passages().size()).isLessThanOrEqualTo(2);
    }
}
