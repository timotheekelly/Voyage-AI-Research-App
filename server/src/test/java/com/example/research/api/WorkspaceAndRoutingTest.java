package com.example.research.api;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;

class WorkspaceAndRoutingTest extends IntegrationTestBase {

    @ParameterizedTest
    @ValueSource(strings = {"v1", "v2", "v3", "v4", "v5"})
    void everyVersionServesTheSharedEndpointsIndependently(String version) throws Exception {
        String owner = uniqueUser();
        mvc.perform(get("/api/" + version + "/workspaces").with(user(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/" + version + "/documents").with(user(owner)))
                .andExpect(status().isBadRequest()) // no workspace yet: explicit, not a silent empty list
                .andExpect(jsonPath("$.message").value("You do not belong to any workspace yet. Create one first."));
        mvc.perform(get("/api/" + version + "/conversations").with(user(owner))).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"v1", "v2", "v3", "v4", "v5"})
    void everyVersionHasItsOwnChatEndpoint(String version) throws Exception {
        // Reaches validation of that version's own request type (blank question) rather than a 404.
        mvc.perform(post("/api/" + version + "/chat").with(user(uniqueUser())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"\",\"workspaceId\":\"w\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }

    @Test
    void unknownVersionIsNotFound() throws Exception {
        mvc.perform(get("/api/v6/workspaces").with(user(uniqueUser()))).andExpect(status().isNotFound());
    }

    @Test
    void versionSpecificEndpointsExistOnlyInTheirVersions() throws Exception {
        String u = uniqueUser();
        mvc.perform(get("/api/v3/retrieval/options").with(user(u))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v5/evaluations").with(user(u))).andExpect(status().isOk());
        mvc.perform(get("/api/v4/evaluations").with(user(u))).andExpect(status().isNotFound());
    }

    @Test
    void createsWorkspaceAndEnforcesMembership() throws Exception {
        String owner = uniqueUser();
        String other = uniqueUser();
        String body = mvc.perform(post("/api/v4/workspaces").with(user(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nuclear\",\"description\":\"Energy research\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/api/v4/workspaces/workspace-")))
                .andExpect(jsonPath("$.ownerId").value(owner))
                .andExpect(jsonPath("$.memberIds[0]").value(owner))
                .andReturn().getResponse().getContentAsString();
        String id = jsonField(body, "id");

        mvc.perform(get("/api/v1/workspaces/" + id).with(user(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/workspaces/" + id).with(user(other))).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        mvc.perform(get("/api/v2/workspaces/" + id + "/documents").with(user(other))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/workspaces").with(user(other))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/workspaces/workspace-missing").with(user(owner))).andExpect(status().isNotFound());
    }

    @Test
    void duplicateWorkspaceNameForSameOwnerConflicts() throws Exception {
        String owner = uniqueUser();
        createWorkspace(owner, "Same");
        mvc.perform(post("/api/v1/workspaces").with(user(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"same\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void errorResponsesAreStructured() throws Exception {
        mvc.perform(get("/api/v1/documents/nope").with(user(uniqueUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Document was not found."))
                .andExpect(jsonPath("$.path").value("/api/v1/documents/nope"));
        mvc.perform(post("/api/v1/workspaces").with(user(uniqueUser())).contentType(MediaType.APPLICATION_JSON).content("{bad json"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("MALFORMED_REQUEST"));
        mvc.perform(post("/api/v1/workspaces").with(user(uniqueUser())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details[0]").exists());
    }

    @Test
    void corsAllowsOnlyConfiguredOrigins() throws Exception {
        mvc.perform(options("/api/v1/workspaces").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(options("/api/v1/workspaces").header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
