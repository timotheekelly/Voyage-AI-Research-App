package com.example.research.repository;

import com.example.research.model.ResearchWorkspace;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WorkspaceRepository extends MongoRepository<ResearchWorkspace, String> {
    List<ResearchWorkspace> findByMemberIdsContainingOrderByCreatedAtAsc(String userId);
    boolean existsByOwnerIdAndNameIgnoreCase(String ownerId, String name);
}
