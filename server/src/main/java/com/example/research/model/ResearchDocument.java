package com.example.research.model;

import java.time.Instant;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/** Document metadata. The original file is stored outside MongoDB (see FileStorageService), referenced by storageKey. */
@Document("documents")
@CompoundIndex(name = "workspace_uploaded", def = "{'workspaceId': 1, 'uploadedAt': -1}")
public record ResearchDocument(
        @Id String id,
        String workspaceId,
        String title,
        String filename,
        String contentType,
        String author,
        Integer publicationYear,
        String documentType,
        List<String> tags,
        ProcessingStatus processingStatus,
        String failureReason,
        String storageKey,
        long sizeBytes,
        Integer pageCount,
        Integer chunkCount,
        /** When all chunks were inserted; embedding readiness is then awaited from this point. */
        @Field("chunksStoredAt") Instant chunksStoredAt,
        Instant uploadedAt) {

    public ResearchDocument withStatus(ProcessingStatus status, String failureReason) {
        return new ResearchDocument(id, workspaceId, title, filename, contentType, author, publicationYear, documentType,
                tags, status, failureReason, storageKey, sizeBytes, pageCount, chunkCount, chunksStoredAt, uploadedAt);
    }

    public ResearchDocument withChunks(int pageCount, int chunkCount, Instant storedAt) {
        return new ResearchDocument(id, workspaceId, title, filename, contentType, author, publicationYear, documentType,
                tags, processingStatus, failureReason, storageKey, sizeBytes, pageCount, chunkCount, storedAt, uploadedAt);
    }
}
