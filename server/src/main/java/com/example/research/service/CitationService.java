package com.example.research.service;

import com.example.research.dto.response.Citation;
import com.example.research.retrieval.RetrievedChunk;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Turns the model's [n] markers into verified citations. The prompt numbers the retrieved passages 1..N; here every
 * marker is checked against that range. Markers that do not refer to a retrieved passage are removed, and valid ones
 * are renumbered in order of first use so the returned citations list lines up with the markers in the text.
 */
@Service
public class CitationService {

    private static final Pattern MARKER = Pattern.compile("\\s?\\[(\\d{1,3})]");

    public record Resolved(String answer, List<Citation> citations) {}

    public Resolved resolve(String answer, List<RetrievedChunk> passages, Map<String, String> titlesByDocumentId) {
        Map<Integer, Integer> renumbered = new LinkedHashMap<>(); // original marker -> new marker
        Matcher m = MARKER.matcher(answer);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            int original = Integer.parseInt(m.group(1));
            if (original < 1 || original > passages.size()) {
                m.appendReplacement(out, ""); // invented source: drop the marker
                continue;
            }
            int number = renumbered.computeIfAbsent(original, k -> renumbered.size() + 1);
            String leading = m.group().startsWith(" ") ? " " : "";
            m.appendReplacement(out, Matcher.quoteReplacement(leading + "[" + number + "]"));
        }
        m.appendTail(out);

        List<Citation> citations = new ArrayList<>();
        for (int original : renumbered.keySet()) {
            RetrievedChunk p = passages.get(original - 1);
            citations.add(new Citation(p.documentId(), p.chunkId(),
                    titlesByDocumentId.getOrDefault(p.documentId(), "Untitled document"), p.pageNumber(), p.content(),
                    p.score()));
        }
        return new Resolved(out.toString().strip(), citations);
    }
}
