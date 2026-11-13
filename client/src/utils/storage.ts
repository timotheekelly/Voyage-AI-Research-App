/** localStorage wrappers that never throw (private mode, blocked storage, corrupt JSON). */
export const STORAGE_KEYS = {
  apiVersion: "vra.apiVersion",
  sidebarCollapsed: "vra.sidebarCollapsed",
  retrievalConfig: "vra.retrievalConfig",
} as const;

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readJson(key: string): unknown {
  const raw = readStorage(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeStorage(key, JSON.stringify(value));
}
