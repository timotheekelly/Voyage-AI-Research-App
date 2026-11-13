package com.example.research.service;

import com.example.research.model.DocumentChunk;
import com.example.research.model.ProcessingStatus;
import com.example.research.model.ResearchDocument;
import com.example.research.repository.ChunkRepository;
import com.example.research.repository.DocumentRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Extracts, chunks and stores a document's passages.
 *
 * <p>Embeddings are NOT computed here. Atlas automated embedding watches {@code document_chunks.content} and
 * generates vectors asynchronously inside the search index. After the chunks are stored the document stays
 * PROCESSING; {@link ReadinessMonitor} marks it READY only once its chunks are actually queryable.
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    private final DocumentRepository documents;
    private final ChunkRepository chunks;
    private final MongoTemplate mongo;
    private final FileStorageService storage;
    private final TextExtractor extractor;
    private final TextChunker chunker;
    private final Clock clock;

    public IngestionService(DocumentRepository documents, ChunkRepository chunks, MongoTemplate mongo,
                            FileStorageService storage, TextExtractor extractor, TextChunker chunker, Clock clock) {
        this.documents = documents;
        this.chunks = chunks;
        this.mongo = mongo;
        this.storage = storage;
        this.extractor = extractor;
        this.chunker = chunker;
        this.clock = clock;
    }

    @Async("ingestionExecutor")
    public void ingest(String documentId) {
        ResearchDocument doc = documents.findById(documentId).orElse(null);
        if (doc == null || doc.processingStatus() != ProcessingStatus.PROCESSING) return;
        try {
            List<PageText> pages = extractor.extract(doc.contentType(), storage.load(doc.storageKey()));
            List<TextChunker.ChunkText> pieces = chunker.chunk(pages);
            if (pieces.isEmpty()) throw new DocumentExtractionException("The document produced no searchable text.");

            chunks.deleteByDocumentId(documentId); // idempotent on retry
            List<DocumentChunk> rows = pieces.stream().map(p -> new DocumentChunk(
                    documentId + "-chunk-" + p.index(), documentId, doc.workspaceId(), p.index(), p.text(),
                    p.pageNumber(), p.sectionTitle(), p.startOffset(), p.endOffset(), p.tokenCount(),
                    doc.publicationYear(), doc.documentType(), doc.tags(), false)).toList();
            mongo.insert(rows, DocumentChunk.class);

            int pageCount = (int) pages.stream().map(PageText::pageNumber).distinct().count();
            // Stays PROCESSING: chunks exist, but their embeddings are not known to be queryable yet.
            documents.save(doc.withChunks(pageCount, rows.size(), Instant.now(clock)));
            log.info("Stored {} chunks for document {}; awaiting Atlas embeddings", rows.size(), documentId);
        } catch (DocumentExtractionException e) {
            fail(doc, e.getMessage());
        } catch (Exception e) {
            log.error("Ingestion failed for document {}", documentId, e);
            fail(doc, "Ingestion failed unexpectedly.");
        }
    }

    /** Remove partial output so a FAILED document never has searchable chunks. */
    public void fail(ResearchDocument doc, String reason) {
        try {
            chunks.deleteByDocumentId(doc.id());
        } catch (RuntimeException e) {
            log.warn("Could not clean up chunks for failed document {}", doc.id(), e);
        }
        documents.findById(doc.id()).ifPresent(current ->
                documents.save(current.withStatus(ProcessingStatus.FAILED, reason)));
        log.warn("Document {} marked FAILED: {}", doc.id(), reason);
    }
}
