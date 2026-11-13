package com.example.research.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatV1Request(
        @NotBlank @Size(max = 4000) String question,
        @NotBlank String workspaceId,
        String conversationId) {}
