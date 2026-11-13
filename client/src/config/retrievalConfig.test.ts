import { describe, expect, it } from "vitest";
import { VERSION_CAPABILITIES } from "./capabilities";
import {
  cloneDefaultConfig,
  parseStoredConfig,
  sanitizeConfigForVersion,
  validateRetrievalConfig,
  withCandidateCount,
  withFinalResultCount,
} from "./retrievalConfig";

describe("retrieval configuration", () => {
  it("defaults to hybrid, reranking on, 30 candidates, 5 results", () => {
    const c = cloneDefaultConfig();
    expect(c.retrievalStrategy).toBe("hybrid");
    expect(c.reranking).toEqual({ enabled: true, candidateCount: 30, finalResultCount: 5 });
  });

  it("rejects a final result count above the candidate count", () => {
    const c = cloneDefaultConfig();
    c.reranking = { enabled: true, candidateCount: 10, finalResultCount: 20 };
    const issues = validateRetrievalConfig(c, VERSION_CAPABILITIES.v3);
    expect(issues.map((i) => i.field)).toContain("finalResultCount");
  });

  it("does not validate reranking for versions without it", () => {
    const c = cloneDefaultConfig();
    c.reranking = { enabled: true, candidateCount: 1, finalResultCount: 9 };
    expect(validateRetrievalConfig(c, VERSION_CAPABILITIES.v2)).toEqual([]);
  });

  it("clamps final count when candidate count is lowered, and caps final at candidates", () => {
    const lowered = withCandidateCount(cloneDefaultConfig(), 3);
    expect(lowered.reranking).toMatchObject({ candidateCount: 3, finalResultCount: 3 });
    expect(withFinalResultCount(lowered, 50).reranking.finalResultCount).toBe(3);
  });

  it("flags an inverted year range", () => {
    const c = cloneDefaultConfig();
    c.filters.yearMin = 2026;
    c.filters.yearMax = 2020;
    expect(validateRetrievalConfig(c, VERSION_CAPABILITIES.v4).map((i) => i.field)).toContain("publicationYear");
  });

  it("clears incompatible values and keeps compatible ones when sanitizing for a version", () => {
    const c = cloneDefaultConfig();
    c.retrievalStrategy = "text";
    c.reranking = { enabled: false, candidateCount: 50, finalResultCount: 10 };
    c.filters = { yearMin: 2020, documentTypes: ["report"], tags: ["energy"] };
    c.optimization = { quantization: "int8", diagnostics: true };

    const v3 = sanitizeConfigForVersion(c, VERSION_CAPABILITIES.v3);
    expect(v3.retrievalStrategy).toBe("text"); // kept
    expect(v3.reranking.candidateCount).toBe(50); // kept
    expect(v3.filters).toEqual({ documentTypes: [], tags: [] }); // cleared
    expect(v3.optimization).toEqual({ diagnostics: false }); // cleared

    const v1 = sanitizeConfigForVersion(c, VERSION_CAPABILITIES.v1);
    expect(v1.retrievalStrategy).toBe("hybrid");
    expect(v1.reranking).toEqual(cloneDefaultConfig().reranking);
  });

  it("falls back to defaults for corrupt stored values", () => {
    expect(parseStoredConfig("nonsense")).toEqual(cloneDefaultConfig());
    expect(parseStoredConfig({ retrievalStrategy: "bogus", reranking: { candidateCount: -4 } })).toEqual(cloneDefaultConfig());
  });
});
