package com.example.research.retrieval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.FiltersDto;
import com.example.research.dto.request.RerankingDto;
import com.example.research.exception.ApiException;
import com.example.research.model.RetrievalStrategy;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class RetrievalRequestResolverTest {

    private final RetrievalRequestResolver resolver = new RetrievalRequestResolver(new RetrievalProperties(30, 5, 1000,
            "t", "content", 10, "rerank-2.5", 1, 1, Duration.ofSeconds(30),
            List.of(new RetrievalProperties.Configuration("default", "d", "i", "voyage-4", "none", false, false, ""))));

    @Test
    void defaultsToHybridAndNoReranking() {
        assertThat(resolver.strategy(null)).isEqualTo(RetrievalStrategy.HYBRID);
        assertThat(resolver.strategy(RetrievalStrategy.TEXT)).isEqualTo(RetrievalStrategy.TEXT);
        assertThat(resolver.reranking(null)).isEqualTo(new RetrievalRequestResolver.Reranking(false, 30, 5));
    }

    @Test
    void appliesDefaultCountsWhenOmitted() {
        assertThat(resolver.reranking(new RerankingDto(true, null, null)))
                .isEqualTo(new RetrievalRequestResolver.Reranking(true, 30, 5));
    }

    @Test
    void rejectsFinalCountAboveCandidateCount() {
        assertThatThrownBy(() -> resolver.reranking(new RerankingDto(true, 10, 20)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("cannot exceed");
    }

    @Test
    void rejectsNonPositiveAndOversizedCounts() {
        assertThatThrownBy(() -> resolver.reranking(new RerankingDto(true, 0, 1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> resolver.reranking(new RerankingDto(true, 10, 0))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> resolver.reranking(new RerankingDto(true, 5000, 5))).isInstanceOf(ApiException.class);
    }

    @Test
    void validatesEvenWhenRerankingIsDisabled() {
        assertThatThrownBy(() -> resolver.reranking(new RerankingDto(false, 5, 9))).isInstanceOf(ApiException.class);
        assertThat(resolver.reranking(new RerankingDto(false, 20, 4)))
                .isEqualTo(new RetrievalRequestResolver.Reranking(false, 20, 4));
    }

    @Test
    void filtersRejectInvertedYearRangeAndTreatEmptyAsNone() {
        assertThatThrownBy(() -> resolver.filters(new FiltersDto(new FiltersDto.YearRange(2026, 2020), null, null)))
                .isInstanceOf(ApiException.class);
        assertThat(resolver.filters(new FiltersDto(null, List.of(), List.of()))).isNull();
        assertThat(resolver.filters(null)).isNull();
    }
}
