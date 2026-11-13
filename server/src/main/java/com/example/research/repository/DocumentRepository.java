package com.example.research.repository;

import com.example.research.model.ProcessingStatus;
import com.example.research.model.ResearchDocument;
import java.util.Collection;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DocumentRepository extends MongoRepository<ResearchDocument, String> {
    List<ResearchDocument> findByWorkspaceIdInOrderByUploadedAtDesc(Collection<String> workspaceIds);
    List<ResearchDocument> findByProcessingStatus(ProcessingStatus status);
}
