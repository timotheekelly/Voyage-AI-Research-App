package com.example.research.repository;

import com.example.research.model.Conversation;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByUserIdOrderByUpdatedAtDesc(String userId);
    List<Conversation> findByUserIdAndWorkspaceIdOrderByUpdatedAtDesc(String userId, String workspaceId);
}
