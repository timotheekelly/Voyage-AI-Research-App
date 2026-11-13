package com.example.research.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.research.service.TextChunker.ChunkText;
import java.util.List;
import org.junit.jupiter.api.Test;

class TextChunkerTest {

    private static String words(int n, String prefix) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(prefix).append(i).append(' ');
        return sb.toString().strip();
    }

    @Test
    void respectsTokenBudgetAndOverlapsConsecutiveChunks() {
        TextChunker chunker = new TextChunker(100, 20);
        List<ChunkText> chunks = chunker.chunk(List.of(new PageText(1, null, words(600, "word"))));

        assertThat(chunks).hasSizeGreaterThan(3);
        assertThat(chunks).allSatisfy(c -> assertThat(c.tokenCount()).isLessThanOrEqualTo(100));
        for (int i = 1; i < chunks.size(); i++) {
            // each chunk starts before the previous one ended: that is the overlap
            assertThat(chunks.get(i).startOffset()).isLessThan(chunks.get(i - 1).endOffset());
            assertThat(chunks.get(i).index()).isEqualTo(i);
        }
    }

    @Test
    void offsetsPointAtTheExactSourceText() {
        String text = words(300, "alpha");
        List<ChunkText> chunks = new TextChunker(80, 10).chunk(List.of(new PageText(4, null, text)));
        assertThat(chunks).allSatisfy(c -> {
            assertThat(text.substring(c.startOffset(), c.endOffset())).isEqualTo(c.text());
            assertThat(c.pageNumber()).isEqualTo(4);
        });
    }

    @Test
    void neverMixesPagesOrSections() {
        List<ChunkText> chunks = new TextChunker(100, 20).chunk(List.of(
                new PageText(1, "Intro", words(250, "one")),
                new PageText(2, "Methods", words(250, "two"))));
        assertThat(chunks).allSatisfy(c -> {
            if (c.pageNumber() == 1) assertThat(c.text()).doesNotContain("two");
            else assertThat(c.text()).doesNotContain("one");
        });
        assertThat(chunks).anyMatch(c -> "Methods".equals(c.sectionTitle()));
        // indexes continue across pages
        assertThat(chunks.get(chunks.size() - 1).index()).isEqualTo(chunks.size() - 1);
    }

    @Test
    void shortPageProducesSingleChunkAndEmptyPageNone() {
        TextChunker chunker = new TextChunker(100, 20);
        assertThat(chunker.chunk(List.of(new PageText(1, null, "A short page.")))).hasSize(1);
        assertThat(chunker.chunk(List.of(new PageText(1, null, "   ")))).isEmpty();
    }

    @Test
    void zeroOverlapProducesDisjointChunks() {
        List<ChunkText> chunks = new TextChunker(50, 0).chunk(List.of(new PageText(1, null, words(200, "w"))));
        for (int i = 1; i < chunks.size(); i++) {
            assertThat(chunks.get(i).startOffset()).isGreaterThanOrEqualTo(chunks.get(i - 1).endOffset());
        }
    }
}
