package com.example.research.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.research.retrieval.RetrievedChunk;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CitationServiceTest {

    private final CitationService service = new CitationService();
    private final List<RetrievedChunk> passages = List.of(
            new RetrievedChunk("c1", "d1", "w", "First passage", 3, null, 0.9),
            new RetrievedChunk("c2", "d2", "w", "Second passage", 8, null, 0.8),
            new RetrievedChunk("c3", "d1", "w", "Third passage", 5, null, 0.7));
    private final Map<String, String> titles = Map.of("d1", "Doc One", "d2", "Doc Two");

    @Test
    void mapsMarkersToRealChunksAndRenumbersByFirstUse() {
        var r = service.resolve("Claim A [3]. Claim B [1][3].", passages, titles);
        assertThat(r.answer()).isEqualTo("Claim A [1]. Claim B [2][1].");
        assertThat(r.citations()).extracting(c -> c.chunkId()).containsExactly("c3", "c1");
        assertThat(r.citations().get(0).title()).isEqualTo("Doc One");
        assertThat(r.citations().get(0).pageNumber()).isEqualTo(5);
        assertThat(r.citations().get(0).passage()).isEqualTo("Third passage");
    }

    @Test
    void removesInventedMarkers() {
        var r = service.resolve("Real [2] and invented [9] and zero [0].", passages, titles);
        assertThat(r.answer()).isEqualTo("Real [1] and invented and zero.");
        assertThat(r.citations()).extracting(c -> c.chunkId()).containsExactly("c2");
    }

    @Test
    void answerWithoutMarkersHasNoCitations() {
        var r = service.resolve("I cannot answer from the supplied documents.", passages, titles);
        assertThat(r.citations()).isEmpty();
        assertThat(r.answer()).isEqualTo("I cannot answer from the supplied documents.");
    }

    @Test
    void unknownDocumentGetsPlaceholderTitleNotAnInventedOne() {
        var r = service.resolve("x [1]", passages, Map.of());
        assertThat(r.citations().get(0).title()).isEqualTo("Untitled document");
    }
}
