package com.example.research.controller.v5;

import com.example.research.dto.request.EvaluationRequest;
import com.example.research.evaluation.EvaluationService;
import com.example.research.model.RetrievalEvaluation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** V5 evaluation runs. POST returns 202 immediately; poll GET /{id} for status and results. */
@RestController
@RequestMapping("/api/v5/evaluations")
public class EvaluationController {

    private final EvaluationService evaluations;

    public EvaluationController(EvaluationService evaluations) {
        this.evaluations = evaluations;
    }

    @PostMapping
    public ResponseEntity<RetrievalEvaluation> create(@Valid @RequestBody EvaluationRequest request, Authentication auth) {
        return ResponseEntity.accepted().body(evaluations.submit(auth.getName(), request));
    }

    @GetMapping("/{id}")
    public RetrievalEvaluation get(@PathVariable String id, Authentication auth) {
        return evaluations.get(auth.getName(), id);
    }

    @GetMapping
    public List<RetrievalEvaluation> list(Authentication auth) {
        return evaluations.list(auth.getName());
    }
}
