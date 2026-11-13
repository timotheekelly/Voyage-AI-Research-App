package com.example.research.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Production-style mode: no dev user, so unauthenticated requests are rejected with a structured 401. */
@SpringBootTest(properties = {"MONGODB_URI=mongodb://unused", "OPENAI_API_KEY=unused", "app.security.mode=jwt"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class JwtModeSecurityTest {

    @DynamicPropertySource
    static void mongo(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", () -> IntegrationTestBase.MONGO.getReplicaSetUrl());
    }

    @Autowired MockMvc mvc;
    @MockitoBean JwtDecoder jwtDecoder;

    @Test
    void unauthenticatedRequestsGet401WithStructuredBody() throws Exception {
        mvc.perform(get("/api/v1/workspaces"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.path").value("/api/v1/workspaces"));
    }

    @Test
    void invalidBearerTokensAreRejected() throws Exception {
        org.mockito.Mockito.when(jwtDecoder.decode(org.mockito.ArgumentMatchers.anyString()))
                .thenThrow(new org.springframework.security.oauth2.jwt.BadJwtException("bad"));
        mvc.perform(get("/api/v3/documents").header("Authorization", "Bearer nope")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthEndpointStaysPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().is(org.hamcrest.Matchers.not(401)));
    }
}
