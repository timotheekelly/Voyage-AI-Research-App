import { getRetrievalOptions } from "../api/retrieval";
import type { UseApiResourceResult } from "./useApiResource";
import { useApiResource } from "./useApiResource";
import { useApiVersion } from "./useApiVersion";
import type { RetrievalOptions } from "../types/retrieval";

/** Loads backend-provided filter/model options, only for versions that use them. */
export function useRetrievalOptions(workspaceId: string | undefined): UseApiResourceResult<RetrievalOptions> {
  const { capabilities } = useApiVersion();
  const needed = capabilities.metadataFiltering || capabilities.optimization;
  return useApiResource(
    needed ? ({ version, signal }) => getRetrievalOptions(version, workspaceId, signal) : null,
    [workspaceId, needed],
  );
}
