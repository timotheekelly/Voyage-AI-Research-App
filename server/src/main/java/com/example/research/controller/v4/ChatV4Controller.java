package com.example.research.controller.v4;

import com.example.research.dto.request.ChatV4Request;
import com.example.research.dto.response.ChatResponse;
import com.example.research.retrieval.FilteredRetrievalService;
import com.example.research.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** V4: workspace-scoped retrieval with metadata filters. workspaceId may be omitted to search every accessible workspace. */
@RestController
@RequestMapping("/api/v4")
public class ChatV4Controller {

    private final ChatService chat;
    private final FilteredRetrievalService retrieval;

    public ChatV4Controller(ChatService chat, FilteredRetrievalService retrieval) {
        this.chat = chat;
        this.retrieval = retrieval;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatV4Request r, Authentication auth) {
        return chat.chat(new ChatService.Request(auth.getName(), r.conversationId(), r.workspaceId(), r.question(), true, false),
                scope -> retrieval.retrieve(r.question(), scope, r.retrievalStrategy(), r.reranking(), r.filters()));
    }
}
