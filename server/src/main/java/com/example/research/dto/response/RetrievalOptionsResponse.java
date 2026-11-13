package com.example.research.dto.response;

import java.util.List;

/** Filter values that exist in the caller's accessible workspaces. */
public record RetrievalOptionsResponse(List<String> documentTypes, List<String> tags) {}
