package com.example.research.service;

import com.example.research.config.SecurityProperties;
import com.example.research.model.ResearchWorkspace;
import com.example.research.repository.WorkspaceRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Seeds workspaces for local development: one the dev user owns, one they cannot access (tenant isolation demo). */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DevDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    private final WorkspaceRepository workspaces;
    private final SecurityProperties security;
    private final Clock clock;

    public DevDataSeeder(WorkspaceRepository workspaces, SecurityProperties security, Clock clock) {
        this.workspaces = workspaces;
        this.security = security;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        String dev = security.devUserId();
        seed("workspace-001", "Nuclear Energy Research", "Academic research into nuclear power", dev);
        seed("workspace-002", "Other Team (no access)", "Owned by another user; the dev user cannot see it", "user-002");
        log.warn("Development seed data is enabled. Authenticating every request as '{}'. Never use this in production.", dev);
    }

    private void seed(String id, String name, String description, String owner) {
        if (!workspaces.existsById(id)) {
            workspaces.save(new ResearchWorkspace(id, name, description, owner, List.of(owner), Instant.now(clock)));
        }
    }
}
