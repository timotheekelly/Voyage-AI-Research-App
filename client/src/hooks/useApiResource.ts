import { useCallback, useEffect, useRef, useState } from "react";
import { isCancellation, toApiError, type ApiError } from "../api/errors";
import type { ApiVersion } from "../config/capabilities";
import { useConnection } from "../context/ConnectionContext";
import { useApiVersion } from "./useApiVersion";

export interface ResourceState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

export interface UseApiResourceResult<T> extends ResourceState<T> {
  reload: () => void;
  /** Local update after a confirmed server-side change (e.g. delete). */
  mutate: (updater: (current: T | null) => T | null) => void;
}

type Fetcher<T> = (ctx: { version: ApiVersion; signal: AbortSignal }) => Promise<T>;

/**
 * Loads a version-scoped resource. Reloads when the API version changes or Retry is pressed,
 * clears data from the previous version immediately, and aborts superseded requests.
 * Pass `null` to skip fetching.
 */
export function useApiResource<T>(fetcher: Fetcher<T> | null, deps: readonly unknown[] = []): UseApiResourceResult<T> {
  const { version } = useApiVersion();
  const { retryToken } = useConnection();
  const [state, setState] = useState<ResourceState<T>>({ data: null, error: null, loading: fetcher !== null });
  const [reloadCount, setReloadCount] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const enabled = fetcher !== null;

  useEffect(() => {
    const run = fetcherRef.current;
    if (!run) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    run({ version, signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isCancellation(error)) return;
        setState({ data: null, error: toApiError(error), loading: false });
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, retryToken, reloadCount, enabled, ...deps]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  const mutate = useCallback(
    (updater: (current: T | null) => T | null) => setState((s) => ({ ...s, data: updater(s.data) })),
    [],
  );
  return { ...state, reload, mutate };
}
