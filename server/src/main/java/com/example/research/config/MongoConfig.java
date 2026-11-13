package com.example.research.config;

import java.time.Clock;
import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/** Shared infrastructure beans: a clock (BSON dates come from Instant) and bounded background executors. */
@Configuration
public class MongoConfig {

    public static final String CHUNKS = "document_chunks";

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /** Bounded: at most 2 documents ingest at once, 50 wait; beyond that uploads are rejected with 503. */
    @Bean("ingestionExecutor")
    Executor ingestionExecutor() {
        return bounded("ingestion-", 2, 50);
    }

    /** Evaluation runs are slow and must not starve chat: one at a time, a short queue. */
    @Bean("evaluationExecutor")
    Executor evaluationExecutor() {
        return bounded("evaluation-", 1, 10);
    }

    private static ThreadPoolTaskExecutor bounded(String prefix, int threads, int queue) {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setThreadNamePrefix(prefix);
        ex.setCorePoolSize(threads);
        ex.setMaxPoolSize(threads);
        ex.setQueueCapacity(queue);
        ex.initialize();
        return ex;
    }
}
