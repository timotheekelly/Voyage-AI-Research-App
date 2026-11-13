package com.example.research.api;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import com.example.research.model.ResearchDocument;
import com.example.research.model.ProcessingStatus;
import com.example.research.repository.DocumentRepository;
import com.example.research.retrieval.AtlasChunkSearch;
import com.example.research.retrieval.RetrievalOutcome;
import com.example.research.retrieval.RetrievedChunk;
import com.example.research.service.AnswerGenerationService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.mongodb.MongoDBContainer;

/**
 * Real MongoDB (Testcontainers), real services and controllers. Only the Atlas-only search execution
 * ({@link AtlasChunkSearch}) and the paid LLM call ({@link AnswerGenerationService}) are replaced, so the standard
 * suite runs without cloud services. Atlas behaviour is covered by AtlasIntegrationTest.
 */
@SpringBootTest(properties = {"MONGODB_URI=mongodb://unused", "OPENAI_API_KEY=unused"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
abstract class IntegrationTestBase {

    static final MongoDBContainer MONGO = new MongoDBContainer("mongo:8.0");

    static {
        MONGO.start();
    }

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired MockMvc mvc;
    @Autowired DocumentRepository documents;
    @MockitoBean AtlasChunkSearch atlas;
    @MockitoBean AnswerGenerationService answers;

    /** Creates a workspace owned by {@code owner} and returns its id. */
    String createWorkspace(String owner, String name) throws Exception {
        String body = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/workspaces")
                        .with(user(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"description\":\"d\"}"))
                .andReturn().getResponse().getContentAsString();
        return jsonField(body, "id");
    }

    ResearchDocument saveDocument(String workspaceId, String title, ProcessingStatus status) {
        String id = "document-" + UUID.randomUUID();
        return documents.save(new ResearchDocument(id, workspaceId, title, "f.txt", "text/plain", "Author", 2024,
                "academic-paper", List.of("energy"), status, null, id + ".txt", 10, 1, 1, null, Instant.now()));
    }

    static String uniqueUser() {
        return "user-" + UUID.randomUUID();
    }

    static String jsonField(String json, String field) {
        var m = java.util.regex.Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        if (!m.find()) throw new AssertionError("No field " + field + " in " + json);
        return m.group(1);
    }

    /** Stubs retrieval to return two passages from {@code doc}, echoing the query's strategy/rerank settings. */
    void stubRetrieval(ResearchDocument doc) {
        org.mockito.Mockito.when(atlas.search(org.mockito.ArgumentMatchers.any())).thenAnswer(inv -> {
            var q = (com.example.research.retrieval.RetrievalQuery) inv.getArgument(0);
            var passages = List.of(
                    new RetrievedChunk(doc.id() + "-chunk-0", doc.id(), doc.workspaceId(), "First passage text.", 3, null, 0.9),
                    new RetrievedChunk(doc.id() + "-chunk-1", doc.id(), doc.workspaceId(), "Second passage text.", 7, null, 0.7));
            return new RetrievalOutcome(passages, passages.size(), q.strategy(), q.rerank(), 12);
        });
    }
}
