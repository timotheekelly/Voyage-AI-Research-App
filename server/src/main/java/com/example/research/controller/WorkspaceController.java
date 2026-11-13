package com.example.research.controller;

import com.example.research.dto.request.CreateWorkspaceRequest;
import com.example.research.dto.response.DocumentResponse;
import com.example.research.dto.response.WorkspaceResponse;
import com.example.research.service.DocumentService;
import com.example.research.service.WorkspaceService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Shared across v1-v5: identical contract in every version. */
@RestController
@RequestMapping("/api/{version:v[1-5]}/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaces;
    private final DocumentService documents;

    public WorkspaceController(WorkspaceService workspaces, DocumentService documents) {
        this.workspaces = workspaces;
        this.documents = documents;
    }

    @GetMapping
    public List<WorkspaceResponse> list(Authentication auth) {
        return workspaces.listFor(auth.getName()).stream().map(WorkspaceResponse::from).toList();
    }

    @PostMapping
    public ResponseEntity<WorkspaceResponse> create(@PathVariable String version, @Valid @RequestBody CreateWorkspaceRequest request,
                                                    Authentication auth) {
        WorkspaceResponse created = WorkspaceResponse.from(workspaces.create(auth.getName(), request));
        return ResponseEntity.created(URI.create("/api/" + version + "/workspaces/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public WorkspaceResponse get(@PathVariable String id, Authentication auth) {
        return WorkspaceResponse.from(workspaces.requireMember(id, auth.getName()));
    }

    @GetMapping("/{id}/documents")
    public List<DocumentResponse> documents(@PathVariable String id, Authentication auth) {
        return documents.list(auth.getName(), id).stream().map(DocumentResponse::from).toList();
    }
}
