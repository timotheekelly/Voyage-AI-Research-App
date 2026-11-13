package com.example.research.service;

import java.util.UUID;

/** Readable string ids such as "document-3f2a...". */
public final class Ids {
    private Ids() {}

    public static String newId(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }
}
