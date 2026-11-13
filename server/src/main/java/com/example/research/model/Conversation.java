package com.example.research.model;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("conversations")
@CompoundIndex(name = "user_updated", def = "{'userId': 1, 'updatedAt': -1}")
public record Conversation(
        @Id String id,
        String workspaceId,
        String userId,
        String title,
        Instant createdAt,
        Instant updatedAt) {

    public Conversation touched(Instant now) {
        return new Conversation(id, workspaceId, userId, title, createdAt, now);
    }
}
