package com.example.research.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;

class TextExtractorTest {

    private final TextExtractor extractor = new TextExtractor();

    private static byte[] pdf(String... pageTexts) throws Exception {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String text : pageTexts) {
                PDPage page = new PDPage();
                doc.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.beginText();
                    cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    cs.newLineAtOffset(50, 700);
                    cs.showText(text);
                    cs.endText();
                }
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void extractsTextPerPageWithPageNumbers() throws Exception {
        List<PageText> pages = extractor.extract("application/pdf", pdf("Nuclear energy overview", "Reactor safety systems"));
        assertThat(pages).hasSize(2);
        assertThat(pages.get(0).pageNumber()).isEqualTo(1);
        assertThat(pages.get(0).text()).contains("Nuclear energy overview");
        assertThat(pages.get(1).pageNumber()).isEqualTo(2);
        assertThat(pages.get(1).text()).contains("Reactor safety");
    }

    @Test
    void rejectsCorruptPdf() {
        assertThatThrownBy(() -> extractor.extract("application/pdf", "%PDF-1.4 not really a pdf".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(DocumentExtractionException.class);
    }

    @Test
    void rejectsPdfWithNoText() throws Exception {
        assertThatThrownBy(() -> extractor.extract("application/pdf", pdf("")))
                .isInstanceOf(DocumentExtractionException.class).hasMessageContaining("No extractable text");
    }

    @Test
    void splitsMarkdownByHeadingAndIgnoresHeadingsInCodeFences() {
        String md = "Preamble\n\n# Intro\nHello\n\n## Methods\n```\n# not a heading\n```\nText";
        List<PageText> sections = extractor.extract("text/markdown", md.getBytes(StandardCharsets.UTF_8));
        assertThat(sections).extracting(PageText::sectionTitle).containsExactly(null, "Intro", "Methods");
        assertThat(sections.get(2).text()).contains("# not a heading");
    }

    @Test
    void plainTextIsOneBlockOnPageOne() {
        List<PageText> pages = extractor.extract("text/plain", "just text".getBytes(StandardCharsets.UTF_8));
        assertThat(pages).containsExactly(new PageText(1, null, "just text"));
    }
}
