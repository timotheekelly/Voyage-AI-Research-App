package com.example.research.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.research.model.ProcessingStatus;
import com.example.research.repository.ChunkRepository;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;

class DocumentIngestionTest extends IntegrationTestBase {

    @Autowired ChunkRepository chunks;

    private static MockMultipartFile file(String name, String content) {
        return new MockMultipartFile("file", name, "application/octet-stream", content.getBytes());
    }

    @Test
    void uploadStoresChunksButDoesNotMarkReadyUntilEmbeddingsAreQueryable() throws Exception {
        String owner = uniqueUser();
        String ws = createWorkspace(owner, "Docs");
        String text = "Nuclear energy provides low-carbon baseload power. ".repeat(200);

        String body = mvc.perform(multipart("/api/v3/documents").file(file("nuclear.txt", text)).param("workspaceId", ws)
                        .param("author", "Research Institute").param("publicationYear", "2024")
                        .param("documentType", "academic-paper").param("tags", "energy,nuclear").with(user(owner)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.processingStatus").value("PROCESSING"))
                .andExpect(jsonPath("$.title").value("nuclear"))
                .andExpect(jsonPath("$.tags[1]").value("nuclear"))
                .andReturn().getResponse().getContentAsString();
        String id = jsonField(body, "id");

        await().atMost(Duration.ofSeconds(15)).until(() -> chunks.countByDocumentId(id) > 0);

        // Chunks exist, yet the document is still PROCESSING: embeddings are not known to be queryable.
        mvc.perform(get("/api/v3/documents/" + id).with(user(owner)))
                .andExpect(jsonPath("$.processingStatus").value("PROCESSING"))
                .andExpect(jsonPath("$.chunkCount").value((int) chunks.countByDocumentId(id)));

        var stored = chunks.findByDocumentIdOrderByChunkIndex(id);
        assertThat(stored).isNotEmpty().allSatisfy(c -> {
            assertThat(c.workspaceId()).isEqualTo(ws);
            assertThat(c.ready()).isFalse(); // retrieval filters on ready=true, so it is not searchable yet
            assertThat(c.publicationYear()).isEqualTo(2024);
            assertThat(c.documentType()).isEqualTo("academic-paper");
            assertThat(c.tags()).containsExactly("energy", "nuclear");
            assertThat(c.pageNumber()).isEqualTo(1);
        });
        assertThat(stored.get(0).chunkIndex()).isZero();
    }

    @Test
    void processingDocumentCannotBeDeletedButReadyOneCan() throws Exception {
        String owner = uniqueUser();
        String ws = createWorkspace(owner, "Docs");
        var processing = saveDocument(ws, "Busy", ProcessingStatus.PROCESSING);
        mvc.perform(delete("/api/v1/documents/" + processing.id()).with(user(owner))).andExpect(status().isConflict());

        var ready = saveDocument(ws, "Done", ProcessingStatus.READY);
        mvc.perform(delete("/api/v1/documents/" + ready.id()).with(user(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/documents/" + ready.id()).with(user(owner))).andExpect(status().isNotFound());
    }

    @Test
    void failedExtractionMarksDocumentFailedAndLeavesNoChunks() throws Exception {
        String owner = uniqueUser();
        String ws = createWorkspace(owner, "Docs");
        String body = mvc.perform(multipart("/api/v1/documents").file(file("broken.pdf", "%PDF-1.4 garbage, not a real pdf"))
                        .param("workspaceId", ws).with(user(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = jsonField(body, "id");

        await().atMost(Duration.ofSeconds(15)).until(() ->
                documents.findById(id).map(d -> d.processingStatus() == ProcessingStatus.FAILED).orElse(false));
        mvc.perform(get("/api/v1/documents/" + id).with(user(owner)))
                .andExpect(jsonPath("$.processingStatus").value("FAILED"))
                .andExpect(jsonPath("$.failureReason").value("The PDF could not be read."));
        assertThat(chunks.countByDocumentId(id)).isZero();
    }

    @Test
    void rejectsUnsupportedTypesFakePdfsAndEmptyFiles() throws Exception {
        String owner = uniqueUser();
        String ws = createWorkspace(owner, "Docs");
        mvc.perform(multipart("/api/v1/documents").file(file("virus.exe", "MZ")).param("workspaceId", ws).with(user(owner)))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/v1/documents").file(file("fake.pdf", "this is plain text")).param("workspaceId", ws).with(user(owner)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("The file is not a valid PDF."));
        mvc.perform(multipart("/api/v1/documents").file(file("empty.txt", "")).param("workspaceId", ws).with(user(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void nonMembersCannotUploadOrReadDocuments() throws Exception {
        String owner = uniqueUser();
        String intruder = uniqueUser();
        String ws = createWorkspace(owner, "Private");
        mvc.perform(multipart("/api/v1/documents").file(file("a.txt", "hello world")).param("workspaceId", ws).with(user(intruder)))
                .andExpect(status().isForbidden());
        var doc = saveDocument(ws, "Secret", ProcessingStatus.READY);
        mvc.perform(get("/api/v1/documents/" + doc.id()).with(user(intruder))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/documents").param("workspaceId", ws).with(user(intruder))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/documents").param("workspaceId", ws).with(user(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].title").value("Secret"));
    }
}
