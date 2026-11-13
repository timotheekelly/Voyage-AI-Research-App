package com.example.research.service;

import com.example.research.config.IngestionProperties;
import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingType;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Sliding-window chunker over whitespace-delimited words, sized by tokens (cl100k_base via JTokkit; an
 * approximation of Voyage's tokenizer). A chunk never crosses a page or section boundary, and character offsets
 * into the page text are exact because chunks are substrings of the original text.
 */
@Component
public class TextChunker {

    public record ChunkText(int index, Integer pageNumber, String sectionTitle, int startOffset, int endOffset,
                            String text, int tokenCount) {}

    private static final Pattern WORD = Pattern.compile("\\S+");
    private static final Encoding ENCODING = Encodings.newDefaultEncodingRegistry().getEncoding(EncodingType.CL100K_BASE);

    private final int chunkSize;
    private final int overlap;

    @Autowired
    public TextChunker(IngestionProperties props) {
        this(props.chunkSize(), props.chunkOverlap());
    }

    public TextChunker(int chunkSize, int overlap) {
        this.chunkSize = chunkSize;
        this.overlap = overlap;
    }

    public List<ChunkText> chunk(List<PageText> pages) {
        List<ChunkText> chunks = new ArrayList<>();
        for (PageText page : pages) {
            chunkPage(page, chunks);
        }
        return chunks;
    }

    private void chunkPage(PageText page, List<ChunkText> out) {
        String text = page.text();
        List<int[]> spans = new ArrayList<>(); // {start, end, tokens}
        Matcher m = WORD.matcher(text);
        while (m.find()) {
            spans.add(new int[] {m.start(), m.end(), ENCODING.countTokens(" " + m.group())});
        }
        int n = spans.size();
        int i = 0;
        while (i < n) {
            int j = i;
            int total = 0;
            while (j < n && (j == i || total + spans.get(j)[2] <= chunkSize)) {
                total += spans.get(j)[2];
                j++;
            }
            int start = spans.get(i)[0];
            int end = spans.get(j - 1)[1];
            out.add(new ChunkText(out.size(), page.pageNumber(), page.sectionTitle(), start, end,
                    text.substring(start, end), total));
            if (j >= n) break;
            // Next window starts far enough back to repeat roughly `overlap` tokens, but always makes progress.
            int k = j;
            int carried = 0;
            while (k > i + 1 && carried + spans.get(k - 1)[2] <= overlap) {
                carried += spans.get(k - 1)[2];
                k--;
            }
            i = k;
        }
    }
}
