package com.example.research.service;

import com.example.research.config.IngestionProperties;
import com.example.research.exception.ApiException;
import com.example.research.model.ProcessingStatus;
import com.example.research.model.ResearchDocument;
import com.example.research.repository.ChunkRepository;
import com.example.research.repository.DocumentRepository;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Document metadata, upload validation and deletion. Text processing happens in {@link IngestionService}. */
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final Set<String> ALLOWED_TYPES = Set.of("application/pdf", "text/plain", "text/markdown");

    public record UploadMetadata(String title, String author, Integer publicationYear, String documentType, List<String> tags) {}

    private final DocumentRepository documents;
    private final ChunkRepository chunks;
    private final WorkspaceService workspaces;
    private final FileStorageService storage;
    private final IngestionService ingestion;
    private final IngestionProperties props;
    private final Clock clock;

    public DocumentService(DocumentRepository documents, ChunkRepository chunks, WorkspaceService workspaces,
                           FileStorageService storage, IngestionService ingestion, IngestionProperties props, Clock clock) {
        this.documents = documents;
        this.chunks = chunks;
        this.workspaces = workspaces;
        this.storage = storage;
        this.ingestion = ingestion;
        this.props = props;
        this.clock = clock;
    }

    public List<ResearchDocument> list(String userId, String workspaceId) {
        return documents.findByWorkspaceIdInOrderByUploadedAtDesc(workspaces.resolveScope(userId, workspaceId, true));
    }

    public ResearchDocument get(String userId, String documentId) {
        ResearchDocument doc = documents.findById(documentId).orElseThrow(() -> ApiException.notFound("Document"));
        workspaces.requireMember(doc.workspaceId(), userId);
        return doc;
    }

    public ResearchDocument upload(String userId, String workspaceId, MultipartFile file, UploadMetadata meta) {
        workspaces.requireMember(workspaceId, userId);
        String contentType = validate(file);

        String id = Ids.newId("document");
        String filename = sanitizeFilename(file.getOriginalFilename());
        String storageKey = id + extension(contentType);
        String title = meta.title() != null && !meta.title().isBlank() ? meta.title().strip() : stripExtension(filename);

        // UPLOADING while the original is being stored; PROCESSING once ingestion has been queued.
        ResearchDocument doc = documents.save(new ResearchDocument(id, workspaceId, title, filename, contentType,
                blankToNull(meta.author()), meta.publicationYear(),
                meta.documentType() == null || meta.documentType().isBlank() ? "document" : meta.documentType().strip(),
                meta.tags() == null ? List.of() : meta.tags().stream().map(String::strip).filter(t -> !t.isEmpty()).toList(),
                ProcessingStatus.UPLOADING, null, storageKey, file.getSize(), null, null, null, Instant.now(clock)));
        try (InputStream in = file.getInputStream()) {
            storage.store(storageKey, in);
        } catch (IOException | UncheckedIOException e) {
            documents.deleteById(id); // do not leave a document with no file behind
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_FAILED",
                    "The file could not be stored.", e);
        }
        doc = documents.save(doc.withStatus(ProcessingStatus.PROCESSING, null));
        try {
            ingestion.ingest(doc.id());
        } catch (TaskRejectedException e) {
            storage.delete(storageKey);
            documents.deleteById(id);
            throw ApiException.unavailable("INGESTION_BUSY", "The ingestion queue is full. Please try again shortly.", e);
        }
        return doc;
    }

    public void delete(String userId, String documentId) {
        ResearchDocument doc = get(userId, documentId);
        if (doc.processingStatus() == ProcessingStatus.PROCESSING || doc.processingStatus() == ProcessingStatus.UPLOADING) {
            throw ApiException.conflict("The document is still being processed and cannot be deleted yet.");
        }
        chunks.deleteByDocumentId(documentId);
        try {
            storage.delete(doc.storageKey());
        } catch (UncheckedIOException e) {
            log.warn("Could not delete stored file for {}", documentId, e);
        }
        documents.deleteById(documentId);
    }

    /** Decides the content type from the extension and, for PDFs, the file header; client-declared types are not trusted. */
    private String validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("The uploaded file is empty.");
        if (file.getSize() > props.maxFileSizeBytes()) {
            throw new ApiException(org.springframework.http.HttpStatus.CONTENT_TOO_LARGE, "PAYLOAD_TOO_LARGE",
                    "The uploaded file exceeds the maximum allowed size.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String type;
        if (name.endsWith(".pdf")) type = "application/pdf";
        else if (name.endsWith(".md") || name.endsWith(".markdown")) type = "text/markdown";
        else if (name.endsWith(".txt")) type = "text/plain";
        else throw ApiException.badRequest("Unsupported file type. Supported formats: PDF, plain text (.txt), Markdown (.md).");
        if (!ALLOWED_TYPES.contains(type)) throw ApiException.badRequest("Unsupported file type.");
        if (type.equals("application/pdf")) {
            try (InputStream in = file.getInputStream()) {
                byte[] head = in.readNBytes(5);
                if (!new String(head, java.nio.charset.StandardCharsets.ISO_8859_1).equals("%PDF-")) {
                    throw ApiException.badRequest("The file is not a valid PDF.");
                }
            } catch (IOException e) {
                throw ApiException.badRequest("The uploaded file could not be read.");
            }
        }
        return type;
    }

    private static String extension(String contentType) {
        return switch (contentType) {
            case "application/pdf" -> ".pdf";
            case "text/markdown" -> ".md";
            default -> ".txt";
        };
    }

    private static String sanitizeFilename(String name) {
        if (name == null || name.isBlank()) return "upload";
        String base = name.replace('\\', '/');
        return base.substring(base.lastIndexOf('/') + 1);
    }

    private static String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
