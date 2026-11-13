package com.example.research.model;

import com.fasterxml.jackson.annotation.JsonValue;

/** Serialized lowercase ("vector", "text", "hybrid") to match the API contract. */
public enum RetrievalStrategy {
    VECTOR("vector"),
    TEXT("text"),
    HYBRID("hybrid");

    private final String value;

    RetrievalStrategy(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }
}
