package com.example.research.model;

import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A searchable passage. There is deliberately no embedding field: Atlas automated embedding generates the
 * vector from {@code content} inside the search index, so the application never stores or computes it.
 * {@code ready} is flipped to true only once the parent document's embeddings are queryable; retrieval
 * filters on it so half-processed documents are never searched.
 */
@Document("document_chunks")
@CompoundIndex(name = "document_chunk_index", def = "{'documentId': 1, 'chunkIndex': 1}", unique = true)
public record DocumentChunk(
        @Id String id,
        String documentId,
        String workspaceId,
        int chunkIndex,
        String content,
        Integer pageNumber,
        String sectionTitle,
        int startOffset,
        int endOffset,
        int tokenCount,
        Integer publicationYear,
        String documentType,
        List<String> tags,
        boolean ready) {}
