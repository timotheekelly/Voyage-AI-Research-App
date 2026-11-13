import { act, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setTransport } from "../api/client";
import { SearchSettings } from "./retrieval/SearchSettings";
import { useRetrievalConfig } from "../hooks/useRetrievalConfig";
import { useApiVersion } from "../hooks/useApiVersion";
import type { ApiVersion } from "../config/capabilities";
import type { RetrievalOptions } from "../types/retrieval";
import { Providers, renderWithProviders } from "../test/utils";
import { STORAGE_KEYS } from "../utils/storage";

const options: RetrievalOptions = {
  documentTypes: ["report"],
  tags: ["energy"],
  embeddingConfigs: [{ id: "e1", label: "Embedding One" }],
  quantizations: [{ id: "int8", label: "int8" }],
};

/** Selects the version before the providers mount, as a returning user would have it stored. */
function renderAt(version: ApiVersion) {
  setTransport(async () => ({ status: 404, body: undefined }));
  window.localStorage.setItem(STORAGE_KEYS.apiVersion, version);
  return renderWithProviders(<Inner />);
}
function Inner() {
  const { config, update, issues } = useRetrievalConfig();
  return (
    <SearchSettings
      config={config}
      update={update}
      issues={issues}
      options={{ data: options, error: null, loading: false, reload: () => undefined, mutate: () => undefined }}
    />
  );
}

const q = {
  strategy: () => screen.queryByLabelText("Retrieval strategy"),
  rerank: () => screen.queryByRole("switch", { name: "Enable reranking" }),
  candidates: () => screen.queryByLabelText(/Candidate count/),
  finals: () => screen.queryByLabelText(/Final result count/),
  year: () => screen.queryByLabelText("Published from (year)"),
  tags: () => screen.queryByText("Tags"),
  workspace: () => screen.queryByLabelText("Search in workspace"),
  embedding: () => screen.queryByLabelText("Embedding configuration"),
  quant: () => screen.queryByLabelText("Quantization"),
  diagnostics: () => screen.queryByRole("switch", { name: "Enable diagnostics" }),
};

describe("controls per API version", () => {
  const expected: Record<ApiVersion, (keyof typeof q)[]> = {
    v1: [],
    v2: ["strategy"],
    v3: ["strategy", "rerank", "candidates", "finals"],
    v4: ["strategy", "rerank", "candidates", "finals", "year", "tags", "workspace"],
    v5: ["strategy", "rerank", "candidates", "finals", "year", "tags", "workspace", "embedding", "quant", "diagnostics"],
  };

  it.each(Object.keys(expected) as ApiVersion[])("%s shows exactly its controls", (version) => {
    renderAt(version);
    for (const key of Object.keys(q) as (keyof typeof q)[]) {
      if (expected[version].includes(key)) expect(q[key](), `${key} should be visible in ${version}`).toBeInTheDocument();
      else expect(q[key](), `${key} should be hidden in ${version}`).not.toBeInTheDocument();
    }
  });

  it("defaults: hybrid, reranking on, 30 candidates, 5 final", () => {
    renderAt("v3");
    expect(q.strategy()).toHaveValue("hybrid");
    expect(q.rerank()).toBeChecked();
    expect(q.candidates()).toHaveValue("30");
    expect(q.finals()).toHaveValue("5");
  });

  it("never offers a final count above the candidate count", async () => {
    setTransport(async () => ({ status: 404, body: undefined }));
    const user = userEvent.setup();
    renderAt("v3");
    await user.selectOptions(q.candidates()!, "10");
    const finalOptions = Array.from((q.finals() as HTMLSelectElement).options).map((o) => Number(o.value));
    expect(Math.max(...finalOptions)).toBeLessThanOrEqual(10);
    await user.selectOptions(q.candidates()!, "30");
    await user.selectOptions(q.finals()!, "20");
    await user.selectOptions(q.candidates()!, "10"); // lowering candidates clamps final
    expect(q.finals()).toHaveValue("10");
  });

  it("V5 disables embedding and quantization with an explanation when options are unavailable", () => {
    setTransport(async () => ({ status: 404, body: undefined }));
    window.localStorage.setItem(STORAGE_KEYS.apiVersion, "v5");
    function Unavailable() {
      const { config, update, issues } = useRetrievalConfig();
      const err = Object.assign(new Error("x"), { type: "NOT_FOUND" as const, name: "ApiError" });
      return (
        <SearchSettings
          config={config}
          update={update}
          issues={issues}
          options={{ data: null, error: err as never, loading: false, reload: () => undefined, mutate: () => undefined }}
        />
      );
    }
    renderWithProviders(<Unavailable />);
    expect(q.embedding()).toBeDisabled();
    expect(q.quant()).toBeDisabled();
    expect(screen.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
  });
});

describe("config across version switches", () => {
  it("keeps compatible values and clears incompatible ones", async () => {
    setTransport(async () => ({ status: 404, body: undefined }));
    window.localStorage.setItem(STORAGE_KEYS.apiVersion, "v4");
    const { result } = renderHook(() => ({ cfg: useRetrievalConfig(), v: useApiVersion() }), { wrapper: Providers });

    act(() =>
      result.current.cfg.update((c) => ({
        ...c,
        retrievalStrategy: "text",
        filters: { ...c.filters, yearMin: 2020, tags: ["energy"] },
      })),
    );
    expect(result.current.cfg.config.filters.tags).toEqual(["energy"]);

    act(() => result.current.v.setVersion("v3"));
    expect(result.current.cfg.config.retrievalStrategy).toBe("text");
    expect(result.current.cfg.config.filters).toEqual({ documentTypes: [], tags: [] });

    act(() => result.current.v.setVersion("v1"));
    expect(result.current.cfg.config.retrievalStrategy).toBe("hybrid");
  });
});
