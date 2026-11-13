package com.example.research.model;

import com.example.research.dto.response.Citation;
import java.time.Instant;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("chat_messages")
@CompoundIndex(name = "conversation_created", def = "{'conversationId': 1, 'createdAt': 1}")
public record ChatMessage(
        @Id String id,
        String conversationId,
        MessageRole role,
        String content,
        List<Citation> citations,
        Instant createdAt) {}
