package com.example.research.service;

/** Text extracted from one page (or one markdown section, or a whole plain-text file). */
public record PageText(Integer pageNumber, String sectionTitle, String text) {}
