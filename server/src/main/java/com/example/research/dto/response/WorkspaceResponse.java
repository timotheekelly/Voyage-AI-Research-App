package com.example.research.dto.response;

import com.example.research.model.ResearchWorkspace;
import java.time.Instant;
import java.util.List;

public record WorkspaceResponse(String id, String name, String description, String ownerId, List<String> memberIds, Instant createdAt) {
    public static WorkspaceResponse from(ResearchWorkspace w) {
        return new WorkspaceResponse(w.id(), w.name(), w.description(), w.ownerId(), w.memberIds(), w.createdAt());
    }
}
