package com.example.research.dto.response;

import java.util.List;

public record ChatResponse(
        String conversationId,
        String answer,
        List<Citation> citations,
        RetrievalInfo retrieval,
        DiagnosticsInfo diagnostics) {}
