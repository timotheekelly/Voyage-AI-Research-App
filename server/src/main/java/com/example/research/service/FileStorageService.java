package com.example.research.service;

import com.example.research.config.IngestionProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.springframework.stereotype.Service;

/**
 * Stores original uploads on the local filesystem. Binaries stay out of MongoDB; this small concrete class is the
 * only thing to replace to move to GridFS or object storage. Keys are server-generated, never client-supplied.
 */
@Service
public class FileStorageService {

    private final Path root;

    public FileStorageService(IngestionProperties props) {
        this.root = props.storageDir().toAbsolutePath().normalize();
    }

    public void store(String key, InputStream in) {
        try {
            Files.createDirectories(root);
            Files.copy(in, resolve(key), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store file", e);
        }
    }

    public byte[] load(String key) {
        try {
            return Files.readAllBytes(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read stored file", e);
        }
    }

    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not delete stored file", e);
        }
    }

    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) throw new IllegalArgumentException("Invalid storage key");
        return path;
    }
}
