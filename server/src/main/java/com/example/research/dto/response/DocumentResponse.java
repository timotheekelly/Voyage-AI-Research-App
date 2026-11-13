package com.example.research.dto.response;

import com.example.research.model.ProcessingStatus;
import com.example.research.model.ResearchDocument;
import java.time.Instant;
import java.util.List;

public record DocumentResponse(
        String id,
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
        long sizeBytes,
        Integer pageCount,
        Integer chunkCount,
        Instant uploadedAt) {

    public static DocumentResponse from(ResearchDocument d) {
        return new DocumentResponse(d.id(), d.workspaceId(), d.title(), d.filename(), d.contentType(), d.author(),
                d.publicationYear(), d.documentType(), d.tags(), d.processingStatus(), d.failureReason(), d.sizeBytes(),
                d.pageCount(), d.chunkCount(), d.uploadedAt());
    }
}
