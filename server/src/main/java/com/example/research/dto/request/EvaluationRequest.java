package com.example.research.dto.request;

import com.example.research.model.RetrievalStrategy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** An evaluation dataset plus the retrieval configuration under test. K is the final result count. */
public record EvaluationRequest(
        @NotBlank @Size(max = 200) String name,
        @NotBlank String workspaceId,
        RetrievalStrategy retrievalStrategy,
        @Valid RerankingDto reranking,
        @Valid FiltersDto filters,
        String embeddingConfiguration,
        @NotEmpty @Size(max = 200) List<@Valid EvaluationCaseDto> cases) {

    public record EvaluationCaseDto(
            @NotBlank @Size(max = 4000) String question,
            List<String> expectedDocumentIds,
            List<String> expectedChunkIds) {}
}
