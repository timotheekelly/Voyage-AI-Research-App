package com.example.research.model;

import java.time.Instant;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("workspaces")
public record ResearchWorkspace(
        @Id String id,
        String name,
        String description,
        @Indexed String ownerId,
        @Indexed List<String> memberIds,
        Instant createdAt) {

    public boolean hasMember(String userId) {
        return memberIds != null && memberIds.contains(userId);
    }
}
