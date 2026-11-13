package com.example.research.service;

/** Text could not be extracted. The message is safe to store as a document's failure reason. */
public class DocumentExtractionException extends RuntimeException {
    public DocumentExtractionException(String message, Throwable cause) {
        super(message, cause);
    }

    public DocumentExtractionException(String message) {
        super(message);
    }
}
