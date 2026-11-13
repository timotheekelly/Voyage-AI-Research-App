package com.example.research.controller;

import com.example.research.dto.response.DocumentResponse;
import com.example.research.service.DocumentService;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Shared across v1-v5. Upload returns 201 with the document in PROCESSING; it becomes READY once Atlas has embedded it. */
@RestController
@RequestMapping("/api/{version:v[1-5]}/documents")
public class DocumentController {

    private final DocumentService documents;

    public DocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @GetMapping
    public List<DocumentResponse> list(@RequestParam(required = false) String workspaceId, Authentication auth) {
        return documents.list(auth.getName(), workspaceId).stream().map(DocumentResponse::from).toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> upload(
            @PathVariable String version,
            @RequestParam("file") MultipartFile file,
            @RequestParam("workspaceId") String workspaceId,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) Integer publicationYear,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) List<String> tags,
            Authentication auth) {
        var meta = new DocumentService.UploadMetadata(title, author, publicationYear, documentType, tags);
        DocumentResponse created = DocumentResponse.from(documents.upload(auth.getName(), workspaceId, file, meta));
        return ResponseEntity.created(URI.create("/api/" + version + "/documents/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable String id, Authentication auth) {
        return DocumentResponse.from(documents.get(auth.getName(), id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, Authentication auth) {
        documents.delete(auth.getName(), id);
    }
}
