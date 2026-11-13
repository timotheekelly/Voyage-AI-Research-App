import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import { invalidateOutstandingRequests } from "../api/client";
import { DEFAULT_API_VERSION } from "../config/apiVersions";
import { VERSION_CAPABILITIES, isApiVersion, type ApiVersion, type VersionCapabilities } from "../config/capabilities";
import { STORAGE_KEYS, readStorage, writeStorage } from "../utils/storage";

export interface ApiVersionContextValue {
  version: ApiVersion;
  capabilities: VersionCapabilities;
  setVersion: (version: ApiVersion) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ApiVersionContext = createContext<ApiVersionContextValue | null>(null);

function loadInitialVersion(): ApiVersion {
  const stored = readStorage(STORAGE_KEYS.apiVersion);
  return isApiVersion(stored) ? stored : DEFAULT_API_VERSION;
}

export function ApiVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersionState] = useState<ApiVersion>(loadInitialVersion);

  const setVersion = useCallback((next: ApiVersion) => {
    setVersionState((current) => {
      if (current === next) return current;
      invalidateOutstandingRequests(); // cancel everything issued under the previous version
      writeStorage(STORAGE_KEYS.apiVersion, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ version, capabilities: VERSION_CAPABILITIES[version], setVersion }),
    [version, setVersion],
  );
  return <ApiVersionContext.Provider value={value}>{children}</ApiVersionContext.Provider>;
}
