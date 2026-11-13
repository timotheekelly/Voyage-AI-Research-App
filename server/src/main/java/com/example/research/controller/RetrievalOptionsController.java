package com.example.research.controller;

import com.example.research.dto.response.RetrievalOptionsResponse;
import com.example.research.model.ResearchDocument;
import com.example.research.service.WorkspaceService;
import java.util.List;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** V4/V5: the document types and tags that exist in the caller's workspaces, to populate filter controls. */
@RestController
@RequestMapping("/api/{version:v[45]}/retrieval")
public class RetrievalOptionsController {

    private final MongoTemplate mongo;
    private final WorkspaceService workspaces;

    public RetrievalOptionsController(MongoTemplate mongo, WorkspaceService workspaces) {
        this.mongo = mongo;
        this.workspaces = workspaces;
    }

    @GetMapping("/options")
    public RetrievalOptionsResponse options(@RequestParam(required = false) String workspaceId, Authentication auth) {
        List<String> scope = workspaces.resolveScope(auth.getName(), workspaceId, true);
        Query query = Query.query(Criteria.where("workspaceId").in(scope));
        return new RetrievalOptionsResponse(
                mongo.findDistinct(query, "documentType", ResearchDocument.class, String.class).stream().sorted().toList(),
                mongo.findDistinct(query, "tags", ResearchDocument.class, String.class).stream().sorted().toList());
    }
}
