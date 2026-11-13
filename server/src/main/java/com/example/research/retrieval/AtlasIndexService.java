package com.example.research.retrieval;

import com.example.research.config.MongoConfig;
import com.example.research.config.RetrievalProperties;
import com.example.research.exception.ApiException;
import com.mongodb.MongoException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

/**
 * Checks, via $listSearchIndexes, that a required Atlas index exists and is queryable, so a missing index fails
 * loudly instead of silently returning no results. The index list is cached briefly.
 */
@Service
public class AtlasIndexService {

    private final MongoTemplate mongo;
    private final Duration ttl;
    private volatile List<Document> cached = List.of();
    private volatile Instant cachedAt = Instant.EPOCH;

    public AtlasIndexService(MongoTemplate mongo, RetrievalProperties props) {
        this.mongo = mongo;
        this.ttl = props.indexCheckTtl();
    }

    /** @throws ApiException 503 if Atlas Search is unavailable, or the index is missing or still building. */
    public void requireQueryable(String indexName) {
        Document index = find(indexName, false);
        if (index == null) index = find(indexName, true); // re-read once: the index may have just been created
        if (index == null) {
            throw ApiException.unavailable("MISSING_INDEX", "The Atlas index '" + indexName
                    + "' does not exist. Create it from the definitions in the atlas/ directory (see README).", null);
        }
        if (!Boolean.TRUE.equals(index.getBoolean("queryable"))) {
            throw ApiException.unavailable("INDEX_NOT_READY", "The Atlas index '" + indexName
                    + "' exists but is not queryable yet (status: " + index.getString("status") + ").", null);
        }
    }

    /** Non-throwing check used by the configurations endpoint. Returns null if queryable, else a reason. */
    public String unavailableReason(String indexName) {
        try {
            requireQueryable(indexName);
            return null;
        } catch (ApiException e) {
            return e.getMessage();
        }
    }

    private Document find(String name, boolean forceRefresh) {
        return list(forceRefresh).stream().filter(d -> name.equals(d.getString("name"))).findFirst().orElse(null);
    }

    private synchronized List<Document> list(boolean forceRefresh) {
        if (!forceRefresh && Instant.now().isBefore(cachedAt.plus(ttl))) return cached;
        try {
            List<Document> result = new ArrayList<>();
            mongo.getCollection(MongoConfig.CHUNKS)
                    .aggregate(List.of(new Document("$listSearchIndexes", new Document())))
                    .into(result);
            cached = result;
            cachedAt = Instant.now();
            return result;
        } catch (MongoException e) {
            throw ApiException.unavailable("ATLAS_SEARCH_UNAVAILABLE",
                    "Atlas Search / Vector Search is not available on this deployment. A MongoDB Atlas cluster is required.", e);
        }
    }
}
