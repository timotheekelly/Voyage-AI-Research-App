package com.example.research.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

/** Extracts text per page (PDF), per heading section (Markdown) or as one block (plain text). */
@Component
public class TextExtractor {

    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s+(.+?)\\s*#*\\s*$");

    public List<PageText> extract(String contentType, byte[] bytes) {
        List<PageText> pages = switch (contentType) {
            case "application/pdf" -> extractPdf(bytes);
            case "text/markdown" -> extractMarkdown(new String(bytes, StandardCharsets.UTF_8));
            case "text/plain" -> List.of(new PageText(1, null, new String(bytes, StandardCharsets.UTF_8)));
            default -> throw new DocumentExtractionException("Unsupported content type: " + contentType);
        };
        List<PageText> nonBlank = pages.stream().filter(p -> !p.text().isBlank()).toList();
        if (nonBlank.isEmpty()) {
            throw new DocumentExtractionException("No extractable text was found (scanned PDFs need OCR, which is not supported).");
        }
        return nonBlank;
    }

    List<PageText> extractPdf(byte[] bytes) {
        try (PDDocument pdf = Loader.loadPDF(bytes)) {
            if (pdf.isEncrypted()) throw new DocumentExtractionException("The PDF is encrypted.");
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            List<PageText> pages = new ArrayList<>();
            for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                pages.add(new PageText(page, null, stripper.getText(pdf).strip()));
            }
            return pages;
        } catch (IOException e) {
            throw new DocumentExtractionException("The PDF could not be read.", e);
        }
    }

    /** Splits on headings so a chunk never mixes unrelated sections. All sections are page 1 (Markdown has no pages). */
    List<PageText> extractMarkdown(String markdown) {
        List<PageText> sections = new ArrayList<>();
        String title = null;
        StringBuilder body = new StringBuilder();
        boolean inFence = false;
        for (String line : markdown.split("\\R", -1)) {
            if (line.stripLeading().startsWith("```")) inFence = !inFence;
            Matcher m = inFence ? null : HEADING.matcher(line);
            if (m != null && m.matches()) {
                sections.add(new PageText(1, title, body.toString().strip()));
                title = m.group(2);
                body.setLength(0);
            } else {
                body.append(line).append('\n');
            }
        }
        sections.add(new PageText(1, title, body.toString().strip()));
        return sections;
    }
}
