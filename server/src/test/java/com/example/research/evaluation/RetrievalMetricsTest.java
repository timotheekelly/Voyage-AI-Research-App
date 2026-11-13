package com.example.research.evaluation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import org.junit.jupiter.api.Test;

class RetrievalMetricsTest {

    private final List<String> chunks = List.of("c1", "c2", "c3", "c4");
    private final List<String> docs = List.of("dA", "dB", "dA", "dC");

    @Test
    void recallCountsExpectedItemsFoundWithinK() {
        // expected: doc dA, doc dC, chunk c2 -> 3 items
        double atTwo = RetrievalMetrics.recallAtK(List.of("dA", "dC"), List.of("c2"), chunks, docs, 2);
        assertThat(atTwo).isCloseTo(2.0 / 3, within(1e-9)); // dA (rank 1) and c2 (rank 2); dC is outside top 2
        double atFour = RetrievalMetrics.recallAtK(List.of("dA", "dC"), List.of("c2"), chunks, docs, 4);
        assertThat(atFour).isEqualTo(1.0);
    }

    @Test
    void severalChunksOfOneLabelledDocumentCountOnce() {
        assertThat(RetrievalMetrics.recallAtK(List.of("dA"), List.of(), chunks, docs, 4)).isEqualTo(1.0);
    }

    @Test
    void recallIsZeroWhenNothingRelevantAndKLargerThanResultsIsSafe() {
        assertThat(RetrievalMetrics.recallAtK(List.of("dZ"), List.of(), chunks, docs, 10)).isZero();
    }

    @Test
    void recallRequiresLabels() {
        assertThatThrownBy(() -> RetrievalMetrics.recallAtK(List.of(), List.of(), chunks, docs, 3))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reciprocalRankIsInverseRankOfFirstRelevantResult() {
        assertThat(RetrievalMetrics.reciprocalRank(List.of("dC"), List.of(), chunks, docs)).isEqualTo(0.25);
        assertThat(RetrievalMetrics.reciprocalRank(List.of(), List.of("c2"), chunks, docs)).isEqualTo(0.5);
        assertThat(RetrievalMetrics.reciprocalRank(List.of("dA"), List.of(), chunks, docs)).isEqualTo(1.0);
        assertThat(RetrievalMetrics.reciprocalRank(List.of("dZ"), List.of(), chunks, docs)).isZero();
    }

    @Test
    void meanAndNearestRankPercentile() {
        assertThat(RetrievalMetrics.mean(List.of(1.0, 0.5, 0.0))).isEqualTo(0.5);
        List<Double> latencies = List.of(10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0);
        assertThat(RetrievalMetrics.percentile(latencies, 95)).isEqualTo(100.0); // ceil(0.95*10)=10th value
        assertThat(RetrievalMetrics.percentile(latencies, 50)).isEqualTo(50.0);
        assertThat(RetrievalMetrics.percentile(List.of(7.0), 95)).isEqualTo(7.0);
        assertThat(RetrievalMetrics.percentile(List.of(), 95)).isNaN();
    }
}
