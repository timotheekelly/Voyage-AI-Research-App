package com.example.research.controller.v1;

import com.example.research.dto.request.ChatV1Request;
import com.example.research.dto.response.ChatResponse;
import com.example.research.retrieval.VectorRetrievalService;
import com.example.research.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** V1: semantic (vector) retrieval and cited answers. */
@RestController
@RequestMapping("/api/v1")
public class ChatV1Controller {

    private final ChatService chat;
    private final VectorRetrievalService retrieval;

    public ChatV1Controller(ChatService chat, VectorRetrievalService retrieval) {
        this.chat = chat;
        this.retrieval = retrieval;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatV1Request r, Authentication auth) {
        return chat.chat(new ChatService.Request(auth.getName(), r.conversationId(), r.workspaceId(), r.question(), false, false),
                scope -> retrieval.retrieve(r.question(), scope));
    }
}
