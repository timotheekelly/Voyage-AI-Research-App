package com.example.research.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** mode=jwt (default) validates bearer tokens; mode=dev authenticates every request as one seeded user. */
@ConfigurationProperties("app.security")
public record SecurityProperties(Mode mode, String devUserId) {
    public enum Mode { JWT, DEV }

    public SecurityProperties {
        if (mode == null) mode = Mode.JWT;
        if (devUserId == null || devUserId.isBlank()) devUserId = "user-001";
    }
}
