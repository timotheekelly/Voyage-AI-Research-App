package com.example.research.controller;

import com.example.research.dto.request.CreateConversationRequest;
import com.example.research.dto.response.ConversationResponse;
import com.example.research.model.Conversation;
import com.example.research.service.ConversationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Shared across v1-v5. Conversations are private to the user who created them. */
@RestController
@RequestMapping("/api/{version:v[1-5]}/conversations")
public class ConversationController {

    private final ConversationService conversations;

    public ConversationController(ConversationService conversations) {
        this.conversations = conversations;
    }

    @GetMapping
    public List<ConversationResponse> list(@RequestParam(required = false) String workspaceId, Authentication auth) {
        return conversations.list(auth.getName(), workspaceId).stream().map(ConversationResponse::summary).toList();
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> create(@PathVariable String version, @Valid @RequestBody CreateConversationRequest request,
                                                       Authentication auth) {
        Conversation c = conversations.create(auth.getName(), request);
        return ResponseEntity.created(URI.create("/api/" + version + "/conversations/" + c.id()))
                .body(ConversationResponse.withMessages(c, List.of()));
    }

    @GetMapping("/{id}")
    public ConversationResponse get(@PathVariable String id, Authentication auth) {
        Conversation c = conversations.requireOwned(auth.getName(), id);
        return ConversationResponse.withMessages(c, conversations.messagesOf(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, Authentication auth) {
        conversations.delete(auth.getName(), id);
    }
}
