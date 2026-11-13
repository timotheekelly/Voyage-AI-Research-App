package com.example.research.controller.v3;

import com.example.research.dto.request.ChatV3Request;
import com.example.research.dto.response.ChatResponse;
import com.example.research.retrieval.RerankingRetrievalService;
import com.example.research.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** V3: hybrid retrieval plus native $rerank. */
@RestController
@RequestMapping("/api/v3")
public class ChatV3Controller {

    private final ChatService chat;
    private final RerankingRetrievalService retrieval;

    public ChatV3Controller(ChatService chat, RerankingRetrievalService retrieval) {
        this.chat = chat;
        this.retrieval = retrieval;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatV3Request r, Authentication auth) {
        return chat.chat(new ChatService.Request(auth.getName(), r.conversationId(), r.workspaceId(), r.question(), false, false),
                scope -> retrieval.retrieve(r.question(), scope, r.retrievalStrategy(), r.reranking()));
    }
}
