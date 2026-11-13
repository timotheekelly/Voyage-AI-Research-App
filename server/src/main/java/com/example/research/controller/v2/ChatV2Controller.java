package com.example.research.controller.v2;

import com.example.research.dto.request.ChatV2Request;
import com.example.research.dto.response.ChatResponse;
import com.example.research.retrieval.HybridRetrievalService;
import com.example.research.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** V2: vector, text or hybrid ($rankFusion) retrieval. */
@RestController
@RequestMapping("/api/v2")
public class ChatV2Controller {

    private final ChatService chat;
    private final HybridRetrievalService retrieval;

    public ChatV2Controller(ChatService chat, HybridRetrievalService retrieval) {
        this.chat = chat;
        this.retrieval = retrieval;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatV2Request r, Authentication auth) {
        return chat.chat(new ChatService.Request(auth.getName(), r.conversationId(), r.workspaceId(), r.question(), false, false),
                scope -> retrieval.retrieve(r.question(), scope, r.retrievalStrategy()));
    }
}
