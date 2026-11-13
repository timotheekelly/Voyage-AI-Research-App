package com.example.research.controller.v5;

import com.example.research.dto.request.ChatV5Request;
import com.example.research.dto.response.ChatResponse;
import com.example.research.retrieval.OptimizedRetrievalService;
import com.example.research.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** V5: configurable retrieval with optional diagnostics. */
@RestController
@RequestMapping("/api/v5")
public class ChatV5Controller {

    private final ChatService chat;
    private final OptimizedRetrievalService retrieval;

    public ChatV5Controller(ChatService chat, OptimizedRetrievalService retrieval) {
        this.chat = chat;
        this.retrieval = retrieval;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatV5Request r, Authentication auth) {
        boolean diagnostics = r.optimization() != null && Boolean.TRUE.equals(r.optimization().diagnosticsEnabled());
        return chat.chat(new ChatService.Request(auth.getName(), r.conversationId(), r.workspaceId(), r.question(), true, diagnostics),
                scope -> retrieval.retrieve(r.question(), scope, r.retrievalStrategy(), r.reranking(), r.filters(), r.optimization()));
    }

    /** Which retrieval configurations exist and whether their indexes are queryable right now. */
    @org.springframework.web.bind.annotation.GetMapping("/retrieval/configurations")
    public java.util.List<com.example.research.dto.response.RetrievalConfigurationResponse> configurations() {
        return retrieval.configurations();
    }
}
