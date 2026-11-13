import type { ApiVersion } from "../config/capabilities";
import type { RetrievalOptions } from "../types/retrieval";
import { apiClient } from "./client";
import { isServerConfigurationList, isServerRetrievalOptions, toRetrievalOptions } from "./guards";

/**
 * Backend-provided options (V4+): filter values from GET /retrieval/options and, from V5, the supported
 * embedding/quantization configurations from GET /retrieval/configurations. Nothing is hardcoded in the client.
 */
export async function getRetrievalOptions(version: ApiVersion, workspaceId: string | undefined, signal?: AbortSignal): Promise<RetrievalOptions> {
  const options = await apiClient.get(version, "/retrieval/options", isServerRetrievalOptions, { signal, query: { workspaceId } });
  const configs =
    version === "v5" ? await apiClient.get(version, "/retrieval/configurations", isServerConfigurationList, { signal }) : null;
  return toRetrievalOptions(options, configs);
}
