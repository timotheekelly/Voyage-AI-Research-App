package com.example.research.service;

import com.example.research.dto.request.CreateWorkspaceRequest;
import com.example.research.exception.ApiException;
import com.example.research.model.ResearchWorkspace;
import com.example.research.repository.WorkspaceRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

/** Workspace management and the single place where workspace authorization is decided. */
@Service
public class WorkspaceService {

    private final WorkspaceRepository workspaces;
    private final Clock clock;

    public WorkspaceService(WorkspaceRepository workspaces, Clock clock) {
        this.workspaces = workspaces;
        this.clock = clock;
    }

    public List<ResearchWorkspace> listFor(String userId) {
        return workspaces.findByMemberIdsContainingOrderByCreatedAtAsc(userId);
    }

    public ResearchWorkspace create(String userId, CreateWorkspaceRequest request) {
        String name = request.name().strip();
        if (workspaces.existsByOwnerIdAndNameIgnoreCase(userId, name)) {
            throw ApiException.conflict("You already own a workspace named '" + name + "'.");
        }
        return workspaces.save(new ResearchWorkspace(Ids.newId("workspace"), name,
                request.description() == null ? null : request.description().strip(), userId, List.of(userId),
                Instant.now(clock)));
    }

    /** Returns the workspace if the user is a member: 404 if it does not exist, 403 if the user is not a member. */
    public ResearchWorkspace requireMember(String workspaceId, String userId) {
        ResearchWorkspace workspace = workspaces.findById(workspaceId).orElseThrow(() -> ApiException.notFound("Workspace"));
        if (!workspace.hasMember(userId)) {
            throw ApiException.forbidden("You do not have access to this workspace.");
        }
        return workspace;
    }

    /**
     * The workspace ids a request may search. These ids go INTO the retrieval query's filter, so chunks from
     * unauthorized workspaces are never retrieved. With an explicit workspaceId the caller must be a member;
     * without one (only where allowed) the scope is every workspace the caller belongs to.
     */
    public List<String> resolveScope(String userId, String workspaceId, boolean allowAllAccessible) {
        if (workspaceId != null && !workspaceId.isBlank()) {
            return List.of(requireMember(workspaceId, userId).id());
        }
        if (!allowAllAccessible) {
            throw ApiException.badRequest("workspaceId is required.");
        }
        List<String> ids = listFor(userId).stream().map(ResearchWorkspace::id).toList();
        if (ids.isEmpty()) {
            throw ApiException.badRequest("You do not belong to any workspace yet. Create one first.");
        }
        return ids;
    }
}
