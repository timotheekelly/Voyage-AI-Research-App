import { useCallback, useEffect, useState } from "react";
import {
  parseStoredConfig,
  sanitizeConfigForVersion,
  validateRetrievalConfig,
} from "../config/retrievalConfig";
import type { ConfigValidationIssue, RetrievalConfig, RetrievalOptions } from "../types/retrieval";
import { STORAGE_KEYS, readJson, writeJson } from "../utils/storage";
import { useApiVersion } from "./useApiVersion";

export interface UseRetrievalConfigResult {
  config: RetrievalConfig;
  update: (updater: (current: RetrievalConfig) => RetrievalConfig) => void;
  issues: ConfigValidationIssue[];
}

/** Retrieval settings: persisted as a preference, sanitized whenever the API version changes. */
export function useRetrievalConfig(options?: RetrievalOptions | null): UseRetrievalConfigResult {
  const { version, capabilities } = useApiVersion();
  const [config, setConfig] = useState<RetrievalConfig>(() =>
    sanitizeConfigForVersion(parseStoredConfig(readJson(STORAGE_KEYS.retrievalConfig)), capabilities),
  );

  // Version switch: drop incompatible values, keep compatible ones.
  useEffect(() => {
    setConfig((c) => sanitizeConfigForVersion(c, capabilities));
  }, [version, capabilities]);

  // Drop selections the backend no longer offers (e.g. a model removed server-side).
  useEffect(() => {
    if (!options) return;
    setConfig((c) => {
      const o = c.optimization;
      const embeddingOk = !o.embeddingConfigId || options.embeddingConfigs.some((e) => e.id === o.embeddingConfigId);
      const quantOk = !o.quantization || options.quantizations.some((q) => q.id === o.quantization);
      if (embeddingOk && quantOk) return c;
      return {
        ...c,
        optimization: {
          ...o,
          embeddingConfigId: embeddingOk ? o.embeddingConfigId : undefined,
          quantization: quantOk ? o.quantization : undefined,
        },
      };
    });
  }, [options]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.retrievalConfig, config);
  }, [config]);

  const update = useCallback((updater: (c: RetrievalConfig) => RetrievalConfig) => setConfig(updater), []);
  return { config, update, issues: validateRetrievalConfig(config, capabilities) };
}
