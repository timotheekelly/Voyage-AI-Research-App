package com.example.research.repository;

import com.example.research.model.RetrievalEvaluation;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EvaluationRepository extends MongoRepository<RetrievalEvaluation, String> {
    List<RetrievalEvaluation> findByCreatedByOrderByCreatedAtDesc(String createdBy);
}
