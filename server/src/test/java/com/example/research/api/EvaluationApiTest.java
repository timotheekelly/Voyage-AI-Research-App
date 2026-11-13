package com.example.research.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.research.model.ProcessingStatus;
import com.example.research.model.RetrievalEvaluation.EvaluationStatus;
import com.example.research.repository.EvaluationRepository;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class EvaluationApiTest extends IntegrationTestBase {

    @Autowired EvaluationRepository evaluations;

    @Test
    void runsInTheBackgroundAndStoresRecallMrrAndLatencyForLabelledQuestions() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "Eval");
        var doc = saveDocument(ws, "D", ProcessingStatus.READY);
        stubRetrieval(doc); // returns doc-chunk-0 then doc-chunk-1

        String request = """
                {"name":"baseline","workspaceId":"%s","retrievalStrategy":"hybrid",
                 "reranking":{"enabled":true,"candidateCount":30,"finalResultCount":5},
                 "cases":[
                   {"question":"q1","expectedChunkIds":["%s-chunk-1"]},
                   {"question":"q2","expectedDocumentIds":["%s"]},
                   {"question":"q3","expectedDocumentIds":["document-unrelated"]}]}
                """.formatted(ws, doc.id(), doc.id());
        String body = mvc.perform(post("/api/v5/evaluations").with(user(user)).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        String id = jsonField(body, "id");

        await().atMost(Duration.ofSeconds(15)).until(() ->
                evaluations.findById(id).map(e -> e.status() == EvaluationStatus.COMPLETED).orElse(false));

        mvc.perform(get("/api/v5/evaluations/" + id).with(user(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.results.length()").value(3))
                .andExpect(jsonPath("$.results[0].recallAtK").value(1.0))
                .andExpect(jsonPath("$.results[0].reciprocalRank").value(0.5))   // relevant chunk is rank 2
                .andExpect(jsonPath("$.results[1].reciprocalRank").value(1.0))   // doc label matches rank 1
                .andExpect(jsonPath("$.results[2].recallAtK").value(0.0))
                .andExpect(jsonPath("$.aggregate.evaluatedCases").value(3))
                .andExpect(jsonPath("$.aggregate.meanRecallAtK").value(2.0 / 3))
                .andExpect(jsonPath("$.aggregate.mrr").value(0.5))
                .andExpect(jsonPath("$.aggregate.averageLatencyMs").isNumber())
                .andExpect(jsonPath("$.aggregate.p95LatencyMs").isNumber())
                .andExpect(jsonPath("$.configuration.k").value(5));

        mvc.perform(get("/api/v5/evaluations").with(user(user))).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/v5/evaluations/" + id).with(user(uniqueUser()))).andExpect(status().isForbidden());
        assertThat(evaluations.findById(id).orElseThrow().createdAt()).isNotNull(); // stored as a BSON date
    }

    @Test
    void failedCasesAreReportedSeparatelyAndNotScoredAsZero() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "Eval");
        var doc = saveDocument(ws, "D", ProcessingStatus.READY);
        stubRetrieval(doc);
        org.mockito.Mockito.doThrow(com.example.research.exception.ApiException.unavailable("RETRIEVAL_FAILED", "temporarily unavailable", null))
                .when(atlas).search(org.mockito.ArgumentMatchers.argThat(q -> q != null && q.question().equals("boom")));

        String request = """
                {"name":"partial","workspaceId":"%s","cases":[
                  {"question":"ok","expectedDocumentIds":["%s"]},
                  {"question":"boom","expectedDocumentIds":["%s"]}]}
                """.formatted(ws, doc.id(), doc.id());
        String id = jsonField(mvc.perform(post("/api/v5/evaluations").with(user(user)).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString(), "id");
        await().atMost(Duration.ofSeconds(15)).until(() ->
                evaluations.findById(id).map(e -> e.status() == EvaluationStatus.COMPLETED).orElse(false));

        mvc.perform(get("/api/v5/evaluations/" + id).with(user(user)))
                .andExpect(jsonPath("$.aggregate.evaluatedCases").value(1))
                .andExpect(jsonPath("$.aggregate.failedCases").value(1))
                .andExpect(jsonPath("$.aggregate.meanRecallAtK").value(1.0))
                .andExpect(jsonPath("$.results[1].error").value("temporarily unavailable"))
                .andExpect(jsonPath("$.results[1].recallAtK").doesNotExist());
    }

    @Test
    void validatesDatasetsAndAuthorization() throws Exception {
        String owner = uniqueUser();
        String ws = createWorkspace(owner, "Eval");
        String unlabeled = "{\"name\":\"n\",\"workspaceId\":\"" + ws + "\",\"cases\":[{\"question\":\"q\"}]}";
        mvc.perform(post("/api/v5/evaluations").with(user(owner)).contentType(MediaType.APPLICATION_JSON).content(unlabeled))
                .andExpect(status().isBadRequest());
        String empty = "{\"name\":\"n\",\"workspaceId\":\"" + ws + "\",\"cases\":[]}";
        mvc.perform(post("/api/v5/evaluations").with(user(owner)).contentType(MediaType.APPLICATION_JSON).content(empty))
                .andExpect(status().isBadRequest());
        String valid = "{\"name\":\"n\",\"workspaceId\":\"" + ws + "\",\"cases\":[{\"question\":\"q\",\"expectedDocumentIds\":[\"d\"]}]}";
        mvc.perform(post("/api/v5/evaluations").with(user(uniqueUser())).contentType(MediaType.APPLICATION_JSON).content(valid))
                .andExpect(status().isForbidden());
        String badCfg = "{\"name\":\"n\",\"workspaceId\":\"" + ws + "\",\"embeddingConfiguration\":\"nope\",\"cases\":[{\"question\":\"q\",\"expectedDocumentIds\":[\"d\"]}]}";
        mvc.perform(post("/api/v5/evaluations").with(user(owner)).contentType(MediaType.APPLICATION_JSON).content(badCfg))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v5/evaluations/evaluation-missing").with(user(owner))).andExpect(status().isNotFound());
    }
}
