package com.example.research.dto.response;

/** A reference to an actual retrieved chunk. Also embedded in stored assistant messages. */
public record Citation(
        String documentId,
        String chunkId,
        String title,
        Integer pageNumber,
        String passage,
        Double score) {}
