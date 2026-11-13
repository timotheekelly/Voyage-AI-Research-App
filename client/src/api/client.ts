import { apiPrefix, getApiBaseUrl } from "../config/apiVersions";
import type { ApiVersion } from "../config/capabilities";
import type { ActivityOutcome } from "../types/api";
import { ApiError, createApiError, createCancellation, errorTypeFromStatus } from "./errors";
import type { Guard } from "./guards";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface TransportRequest {
  method: HttpMethod;
  url: string;
  /** Path without base URL, including the /api/vN prefix when versioned. */
  path: string;
  version?: ApiVersion;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  formData?: FormData;
  signal: AbortSignal;
}

export interface TransportResponse {
  status: number;
  body: unknown;
  /** True when a 2xx body could not be parsed as JSON. */
  malformed?: boolean;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export const fetchTransport: Transport = async (req) => {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (req.formData) {
    body = req.formData; // browser sets multipart boundary
  } else if (req.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.body);
  }
  const res = await fetch(req.url, { method: req.method, headers, body, signal: req.signal });
  const text = await res.text();
  if (text.trim() === "") return { status: res.status, body: undefined };
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: undefined, malformed: true };
  }
};

let transport: Transport = fetchTransport;

/** Swap the transport (used by mock mode and tests). Pass null to restore real HTTP. */
export function setTransport(next: Transport | null): void {
  transport = next ?? fetchTransport;
}

// --- Connection activity: derived from real requests, never polled ---
type ActivityListener = (outcome: ActivityOutcome) => void;
const listeners = new Set<ActivityListener>();
export function subscribeToActivity(listener: ActivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function report(outcome: ActivityOutcome): void {
  listeners.forEach((l) => l(outcome));
}

// --- Version invalidation: aborts every outstanding request ---
let epochController = new AbortController();
export function invalidateOutstandingRequests(): void {
  epochController.abort();
  epochController = new AbortController();
}

export const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestOptions {
  method?: HttpMethod;
  /** Omit for unversioned routes such as a health check. */
  version?: ApiVersion;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, version?: ApiVersion, query?: RequestOptions["query"]): { url: string; fullPath: string } {
  const fullPath = `${version ? apiPrefix(version) : ""}${path}`;
  const params = new URLSearchParams();
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return { url: `${getApiBaseUrl()}${fullPath}${qs ? `?${qs}` : ""}`, fullPath };
}

async function execute(opts: RequestOptions): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const unlink: Array<() => void> = [];
  const link = (signal: AbortSignal | undefined) => {
    if (!signal) return;
    if (signal.aborted) {
      controller.abort();
      return;
    }
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    unlink.push(() => signal.removeEventListener("abort", onAbort));
  };
  link(opts.signal);
  link(epochController.signal);

  try {
    if (controller.signal.aborted) throw createCancellation();
    const { url, fullPath } = buildUrl(opts.path, opts.version, opts.query);
    const res = await transport({
      method: opts.method ?? "GET",
      url,
      path: fullPath,
      version: opts.version,
      query: opts.query,
      body: opts.body,
      formData: opts.formData,
      signal: controller.signal,
    });
    report("reachable"); // any HTTP response proves the server is up, even a 404
    if (res.status >= 200 && res.status < 300) {
      if (res.malformed) throw createApiError("INVALID_RESPONSE", res.status);
      return res.body;
    }
    throw createApiError(errorTypeFromStatus(res.status), res.status);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      if (timedOut) {
        report("unreachable");
        throw createApiError("TIMEOUT");
      }
      throw createCancellation();
    }
    report("unreachable");
    throw createApiError("NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
    unlink.forEach((fn) => fn());
  }
}

/** Typed request. The response body must satisfy `guard`, else INVALID_RESPONSE is thrown. */
export async function request<T>(opts: RequestOptions, guard: Guard<T>): Promise<T> {
  const data = await execute(opts);
  if (!guard(data)) throw createApiError("INVALID_RESPONSE");
  return data;
}

/** For endpoints whose response body is irrelevant (e.g. DELETE → 204). */
export async function requestNoContent(opts: RequestOptions): Promise<void> {
  await execute(opts);
}

type Common = Omit<RequestOptions, "method" | "path" | "body" | "formData">;

export const apiClient = {
  get: <T>(version: ApiVersion, path: string, guard: Guard<T>, opts: Common = {}) =>
    request({ ...opts, method: "GET", version, path }, guard),
  post: <T>(version: ApiVersion, path: string, body: unknown, guard: Guard<T>, opts: Common = {}) =>
    request({ ...opts, method: "POST", version, path, body }, guard),
  put: <T>(version: ApiVersion, path: string, body: unknown, guard: Guard<T>, opts: Common = {}) =>
    request({ ...opts, method: "PUT", version, path, body }, guard),
  patch: <T>(version: ApiVersion, path: string, body: unknown, guard: Guard<T>, opts: Common = {}) =>
    request({ ...opts, method: "PATCH", version, path, body }, guard),
  delete: (version: ApiVersion, path: string, opts: Common = {}) =>
    requestNoContent({ ...opts, method: "DELETE", version, path }),
  upload: <T>(version: ApiVersion, path: string, formData: FormData, guard: Guard<T>, opts: Common = {}) =>
    request({ timeoutMs: 120_000, ...opts, method: "POST", version, path, formData }, guard),
};

/** Probe an optional, unversioned health endpoint. Resolves true if the server is healthy. */
export async function checkHealth(path: string, signal?: AbortSignal): Promise<boolean> {
  try {
    await requestNoContent({ path, signal, timeoutMs: 8_000 });
    return true;
  } catch (e) {
    // 404 means a server answered but has no such route; the server itself is reachable.
    return e instanceof ApiError && e.type === "NOT_FOUND";
  }
}
