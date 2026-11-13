package com.example.research.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateConversationRequest(@NotBlank String workspaceId, @Size(max = 200) String title) {}
