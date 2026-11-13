package com.example.research.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.research.exception.ApiException;
import com.example.research.model.ProcessingStatus;
import com.example.research.model.RetrievalStrategy;
import com.example.research.repository.ConversationRepository;
import com.example.research.retrieval.RetrievalOutcome;
import com.example.research.retrieval.RetrievalQuery;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class ChatVersionsTest extends IntegrationTestBase {

    @Autowired ConversationRepository conversationRepo;

    private ResultActions chat(String version, String user, String json) throws Exception {
        return mvc.perform(post("/api/" + version + "/chat").with(user(user)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private RetrievalQuery lastQuery() {
        ArgumentCaptor<RetrievalQuery> captor = ArgumentCaptor.forClass(RetrievalQuery.class);
        verify(atlas, org.mockito.Mockito.atLeastOnce()).search(captor.capture());
        return captor.getAllValues().get(captor.getAllValues().size() - 1);
    }

    // ---- V1 ----

    @Test
    void v1ReturnsVerifiedCitationsAndPersistsTheConversation() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        var doc = saveDocument(ws, "Nuclear Energy Review", ProcessingStatus.READY);
        stubRetrieval(doc);
        when(answers.generate(anyString(), any(), any())).thenReturn("Nuclear provides baseload [2]. Invented source [9].");

        String body = chat("v1", user, "{\"question\":\"What are the findings?\",\"workspaceId\":\"" + ws + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("Nuclear provides baseload [1]. Invented source."))
                .andExpect(jsonPath("$.citations.length()").value(1))
                .andExpect(jsonPath("$.citations[0].documentId").value(doc.id()))
                .andExpect(jsonPath("$.citations[0].chunkId").value(doc.id() + "-chunk-1"))
                .andExpect(jsonPath("$.citations[0].title").value("Nuclear Energy Review"))
                .andExpect(jsonPath("$.citations[0].pageNumber").value(7))
                .andExpect(jsonPath("$.citations[0].passage").value("Second passage text."))
                .andExpect(jsonPath("$.retrieval.strategy").value("vector"))
                .andExpect(jsonPath("$.retrieval.rerankingEnabled").value(false))
                .andExpect(jsonPath("$.retrieval.candidateCount").value(2))
                .andExpect(jsonPath("$.retrieval.finalResultCount").value(2))
                .andExpect(jsonPath("$.diagnostics").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String conversationId = jsonField(body, "conversationId");
        assertThat(lastQuery().strategy()).isEqualTo(RetrievalStrategy.VECTOR);
        assertThat(lastQuery().workspaceIds()).containsExactly(ws);

        // persisted: two messages, the assistant one carrying its citations
        mvc.perform(get("/api/v1/conversations/" + conversationId).with(user(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(2))
                .andExpect(jsonPath("$.messages[0].role").value("USER"))
                .andExpect(jsonPath("$.messages[1].role").value("ASSISTANT"))
                .andExpect(jsonPath("$.messages[1].citations[0].title").value("Nuclear Energy Review"));

        // continuing the conversation appends rather than creating a new one
        chat("v1", user, "{\"question\":\"And more?\",\"workspaceId\":\"" + ws + "\",\"conversationId\":\"" + conversationId + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.conversationId").value(conversationId));
        mvc.perform(get("/api/v1/conversations/" + conversationId).with(user(user)))
                .andExpect(jsonPath("$.messages.length()").value(4));
        mvc.perform(get("/api/v2/conversations").param("workspaceId", ws).with(user(user)))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].messages").doesNotExist());
    }

    @Test
    void conversationsArePrivateAndDeletable() throws Exception {
        String user = uniqueUser();
        String other = uniqueUser();
        String ws = createWorkspace(user, "W");
        String body = mvc.perform(post("/api/v1/conversations").with(user(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"workspaceId\":\"" + ws + "\",\"title\":\"Mine\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("Mine")).andReturn().getResponse().getContentAsString();
        String id = jsonField(body, "id");
        mvc.perform(get("/api/v1/conversations/" + id).with(user(other))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/conversations/" + id).with(user(other))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/conversations/" + id).with(user(user))).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/conversations/" + id).with(user(user))).andExpect(status().isNotFound());
    }

    @Test
    void v1RejectsSettingsFromLaterVersions() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        for (String extra : List.of("\"retrievalStrategy\":\"text\"", "\"reranking\":{\"enabled\":true}", "\"filters\":{}",
                "\"optimization\":{}", "\"userId\":\"someone-else\"")) {
            chat("v1", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\"," + extra + "}")
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("MALFORMED_REQUEST"));
        }
        verify(atlas, never()).search(any());
    }

    @Test
    void v1RequiresAWorkspaceAndValidQuestion() throws Exception {
        String user = uniqueUser();
        chat("v1", user, "{\"question\":\"q\"}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        chat("v1", user, "{\"workspaceId\":\"w\"}").andExpect(status().isBadRequest());
        chat("v1", user, "{\"question\":\"" + "x".repeat(4001) + "\",\"workspaceId\":\"w\"}").andExpect(status().isBadRequest());
    }

    // ---- V2 ----

    @Test
    void v2SelectsTheRequestedStrategyAndDefaultsToHybrid() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        stubRetrieval(saveDocument(ws, "D", ProcessingStatus.READY));
        when(answers.generate(anyString(), any(), any())).thenReturn("Answer [1]");
        for (var entry : List.of(java.util.Map.entry("vector", RetrievalStrategy.VECTOR), java.util.Map.entry("text", RetrievalStrategy.TEXT),
                java.util.Map.entry("hybrid", RetrievalStrategy.HYBRID))) {
            chat("v2", user, "{\"question\":\"AP1000\",\"workspaceId\":\"" + ws + "\",\"retrievalStrategy\":\"" + entry.getKey() + "\"}")
                    .andExpect(status().isOk()).andExpect(jsonPath("$.retrieval.strategy").value(entry.getKey()));
            assertThat(lastQuery().strategy()).isEqualTo(entry.getValue());
            assertThat(lastQuery().rerank()).isFalse();
        }
        chat("v2", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\"}").andExpect(status().isOk());
        assertThat(lastQuery().strategy()).isEqualTo(RetrievalStrategy.HYBRID);
        chat("v2", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"retrievalStrategy\":\"bogus\"}").andExpect(status().isBadRequest());
        chat("v2", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"reranking\":{\"enabled\":true}}").andExpect(status().isBadRequest());
    }

    // ---- V3 ----

    @Test
    void v3PassesRerankingConfigurationAndValidatesIt() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        stubRetrieval(saveDocument(ws, "D", ProcessingStatus.READY));
        when(answers.generate(anyString(), any(), any())).thenReturn("Answer [1]");

        chat("v3", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"retrievalStrategy\":\"hybrid\","
                + "\"reranking\":{\"enabled\":true,\"candidateCount\":30,\"finalResultCount\":5}}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.retrieval.rerankingEnabled").value(true));
        RetrievalQuery q = lastQuery();
        assertThat(q.rerank()).isTrue();
        assertThat(q.candidateCount()).isEqualTo(30);
        assertThat(q.finalCount()).isEqualTo(5);

        chat("v3", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"reranking\":{\"enabled\":false,\"candidateCount\":20,\"finalResultCount\":4}}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.retrieval.rerankingEnabled").value(false));
        assertThat(lastQuery().rerank()).isFalse();
        assertThat(lastQuery().finalCount()).isEqualTo(4);

        int callsBefore = org.mockito.Mockito.mockingDetails(atlas).getInvocations().size();
        for (String bad : List.of("{\"enabled\":true,\"candidateCount\":10,\"finalResultCount\":20}",
                "{\"enabled\":true,\"candidateCount\":0,\"finalResultCount\":1}",
                "{\"enabled\":true,\"candidateCount\":10,\"finalResultCount\":-1}",
                "{\"enabled\":true,\"candidateCount\":5000,\"finalResultCount\":5}")) {
            chat("v3", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"reranking\":" + bad + "}").andExpect(status().isBadRequest());
        }
        assertThat(org.mockito.Mockito.mockingDetails(atlas).getInvocations().size()).isEqualTo(callsBefore); // rejected before searching
    }

    // ---- V1-V5 authorization ----

    @Test
    void everyVersionEnforcesWorkspaceAuthorizationBeforeRetrieving() throws Exception {
        String owner = uniqueUser();
        String intruder = uniqueUser();
        String ws = createWorkspace(owner, "Private");
        for (String v : List.of("v1", "v2", "v3", "v4", "v5")) {
            chat(v, intruder, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\"}")
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        }
        chat("v1", owner, "{\"question\":\"q\",\"workspaceId\":\"workspace-missing\"}").andExpect(status().isNotFound());
        verify(atlas, never()).search(any());
    }

    // ---- V4 ----

    @Test
    void v4TenantIsolationScopesRetrievalToAccessibleWorkspacesInsideTheQuery() throws Exception {
        String user = uniqueUser();
        String stranger = uniqueUser();
        String mine1 = createWorkspace(user, "Mine 1");
        String mine2 = createWorkspace(user, "Mine 2");
        String theirs = createWorkspace(stranger, "Theirs");
        stubRetrieval(saveDocument(mine1, "D", ProcessingStatus.READY));
        when(answers.generate(anyString(), any(), any())).thenReturn("Answer [1]");

        // no workspaceId: scope is exactly the caller's workspaces, never the stranger's
        chat("v4", user, "{\"question\":\"q\"}").andExpect(status().isOk());
        assertThat(lastQuery().workspaceIds()).containsExactlyInAnyOrder(mine1, mine2).doesNotContain(theirs);

        // explicit workspace the caller does not belong to
        chat("v4", user, "{\"question\":\"q\",\"workspaceId\":\"" + theirs + "\"}").andExpect(status().isForbidden());
        chat("v4", stranger, "{\"question\":\"q\"}").andExpect(status().isOk());
        assertThat(lastQuery().workspaceIds()).containsExactly(theirs);

        // a caller with no workspaces gets an explicit error, not a global search
        chat("v4", uniqueUser(), "{\"question\":\"q\"}").andExpect(status().isBadRequest());
    }

    @Test
    void v4PassesMetadataFiltersAndValidatesThem() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        stubRetrieval(saveDocument(ws, "D", ProcessingStatus.READY));
        when(answers.generate(anyString(), any(), any())).thenReturn("Answer [1]");

        chat("v4", user, "{\"question\":\"recent research\",\"workspaceId\":\"" + ws + "\",\"retrievalStrategy\":\"hybrid\","
                + "\"reranking\":{\"enabled\":true,\"candidateCount\":30,\"finalResultCount\":5},"
                + "\"filters\":{\"publicationYear\":{\"min\":2020,\"max\":2026},\"documentTypes\":[\"academic-paper\"],\"tags\":[\"energy\"]}}")
                .andExpect(status().isOk());
        var f = lastQuery().filters();
        assertThat(f.publicationYear().min()).isEqualTo(2020);
        assertThat(f.publicationYear().max()).isEqualTo(2026);
        assertThat(f.documentTypes()).containsExactly("academic-paper");
        assertThat(f.tags()).containsExactly("energy");

        chat("v4", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"filters\":{}}").andExpect(status().isOk());
        assertThat(lastQuery().filters()).isNull();
        chat("v4", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"filters\":{\"publicationYear\":{\"min\":2026,\"max\":2020}}}")
                .andExpect(status().isBadRequest());
        chat("v3", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"filters\":{}}").andExpect(status().isBadRequest()); // not a V3 field
    }

    @Test
    void retrievalOptionsListOnlyValuesFromAccessibleWorkspaces() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        saveDocument(ws, "D", ProcessingStatus.READY);
        saveDocument(createWorkspace(uniqueUser(), "Other"), "Hidden", ProcessingStatus.READY);
        mvc.perform(get("/api/v4/retrieval/options").with(user(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentTypes[0]").value("academic-paper"))
                .andExpect(jsonPath("$.tags[0]").value("energy"));
    }

    // ---- V5 ----

    @Test
    void v5ReturnsOnlyMeasuredDiagnosticsWhenRequested() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        stubRetrieval(saveDocument(ws, "D", ProcessingStatus.READY));
        when(answers.generate(anyString(), any(), any())).thenReturn("Answer [1]");
        String request = "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"retrievalStrategy\":\"hybrid\","
                + "\"reranking\":{\"enabled\":true,\"candidateCount\":30,\"finalResultCount\":5},\"filters\":{},"
                + "\"optimization\":{\"embeddingConfiguration\":\"default\",\"quantization\":\"none\",\"diagnosticsEnabled\":%s}}";

        chat("v5", user, request.formatted("true")).andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnostics.retrievalLatencyMs").value(12))
                .andExpect(jsonPath("$.diagnostics.totalLatencyMs").isNumber())
                .andExpect(jsonPath("$.diagnostics.generationLatencyMs").isNumber())
                .andExpect(jsonPath("$.diagnostics.candidateCount").value(2))
                .andExpect(jsonPath("$.diagnostics.finalPassageCount").value(2))
                .andExpect(jsonPath("$.diagnostics.strategy").value("hybrid"))
                .andExpect(jsonPath("$.diagnostics.rerankingLatencyMs").doesNotExist()) // not separately measurable
                .andExpect(jsonPath("$.diagnostics.recallAtK").doesNotExist())          // needs relevance labels
                .andExpect(jsonPath("$.diagnostics.mrr").doesNotExist());
        chat("v5", user, request.formatted("false")).andExpect(status().isOk()).andExpect(jsonPath("$.diagnostics").doesNotExist());
    }

    @Test
    void v5RejectsUnsupportedConfigurationsAndListsTheSupportedOnes() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        chat("v5", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"optimization\":{\"embeddingConfiguration\":\"my-own-model\"}}")
                .andExpect(status().isBadRequest());
        chat("v5", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\",\"optimization\":{\"quantization\":\"binary\"}}")
                .andExpect(status().isBadRequest());
        verify(atlas, never()).search(any());

        mvc.perform(get("/api/v5/retrieval/configurations").with(user(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("default"))
                .andExpect(jsonPath("$[0].embeddingModel").value("voyage-4"))
                .andExpect(jsonPath("$[0].requiresReindex").value(false))
                .andExpect(jsonPath("$[0].available").value(false)); // no Atlas indexes in this test database
    }

    // ---- failure behaviour ----

    @Test
    void noRetrievedPassagesYieldsAnHonestNoticeWithoutCallingTheModel() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        when(atlas.search(any())).thenAnswer(inv -> new RetrievalOutcome(List.of(), 0,
                ((RetrievalQuery) inv.getArgument(0)).strategy(), false, 3));
        chat("v1", user, "{\"question\":\"unanswerable\",\"workspaceId\":\"" + ws + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.citations.length()").value(0))
                .andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("can't answer it reliably")))
                .andExpect(jsonPath("$.retrieval.candidateCount").value(0));
        verify(answers, never()).generate(anyString(), any(), any());
    }

    @Test
    void retrievalFailureReturns503WithoutFabricatingAnAnswerOrPersisting() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        when(atlas.search(any())).thenThrow(ApiException.unavailable("MISSING_INDEX", "The Atlas index 'x' does not exist.", null));
        chat("v1", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\"}")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("MISSING_INDEX"))
                .andExpect(jsonPath("$.path").value("/api/v1/chat"))
                .andExpect(jsonPath("$.answer").doesNotExist());
        assertThat(conversationRepo.findByUserIdOrderByUpdatedAtDesc(user)).isEmpty();
    }

    @Test
    void llmFailureReturns503AndPersistsNothing() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        stubRetrieval(saveDocument(ws, "D", ProcessingStatus.READY));
        when(answers.generate(anyString(), any(), any()))
                .thenThrow(ApiException.unavailable("LLM_UNAVAILABLE", "The language model is temporarily unavailable.", null));
        chat("v2", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\"}")
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("LLM_UNAVAILABLE"));
        assertThat(conversationRepo.findByUserIdOrderByUpdatedAtDesc(user)).isEmpty();
    }

    @Test
    void unexpectedFailuresReturnGeneric500WithoutLeakingDetails() throws Exception {
        String user = uniqueUser();
        String ws = createWorkspace(user, "W");
        when(atlas.search(any())).thenThrow(new IllegalStateException("secret connection string mongodb://admin:hunter2@host"));
        chat("v1", user, "{\"question\":\"q\",\"workspaceId\":\"" + ws + "\"}")
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred."));
    }
}
