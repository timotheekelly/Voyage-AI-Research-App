package com.example.research.dto.request;

import jakarta.validation.Valid;
import java.util.List;

/** Metadata filters (V4+). Every field is optional; absent fields apply no restriction. */
public record FiltersDto(@Valid YearRange publicationYear, List<String> documentTypes, List<String> tags) {

    public record YearRange(Integer min, Integer max) {}

    public boolean isEmpty() {
        return (publicationYear == null || (publicationYear.min() == null && publicationYear.max() == null))
                && (documentTypes == null || documentTypes.isEmpty())
                && (tags == null || tags.isEmpty());
    }
}
