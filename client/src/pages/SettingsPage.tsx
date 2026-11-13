import { RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { ApiVersionSelector } from "../components/settings/ApiVersionSelector";
import { Notice } from "../components/common/Notice";
import { buttonSecondary } from "../components/common/styles";
import { expectedEndpoints, getApiBaseUrl, getHealthPath, getVersionInfo } from "../config/apiVersions";
import { useConnection } from "../context/ConnectionContext";
import { useApiVersion } from "../hooks/useApiVersion";
import { STORAGE_KEYS, removeStorage } from "../utils/storage";

const STATUS_TEXT = { checking: "Checking…", connected: "Connected", unavailable: "Unavailable" } as const;

export function SettingsPage() {
  const { version } = useApiVersion();
  const { status, retry, mockMode } = useConnection();
  const [message, setMessage] = useState<string | null>(null);
  const first = useRef(version);
  const info = getVersionInfo(version);
  const healthPath = getHealthPath();

  // Announce a switch (but not the initial render).
  const announced = first.current !== version ? `Switched to ${info.label} · ${info.name}. In-flight requests were cancelled and version-specific data is reloading.` : null;

  return (
    <div className="mx-auto h-full w-full max-w-3xl space-y-10 overflow-y-auto px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      </div>

      <ApiVersionSelector />
      <div aria-live="polite">{announced && <Notice tone="info">{announced}</Notice>}</div>

      <section aria-labelledby="connection-heading" className="space-y-3">
        <h2 id="connection-heading" className="text-base font-semibold">
          Connection
        </h2>
        <dl className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {[
            ["Mode", mockMode ? "Demo Mode (sample data, no backend calls)" : "Live API"],
            ["Base URL", mockMode ? "— (mock transport)" : getApiBaseUrl()],
            ["Status", STATUS_TEXT[status]],
            ["Health endpoint", healthPath ?? "Not configured: status is derived from API requests"],
            ["Active routes", `/api/${version}/…`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-2 px-3.5 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-xs break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className={buttonSecondary} onClick={retry}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Check connection
        </button>

        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-medium">Expected endpoints for {info.label}</summary>
          <ul className="divide-y divide-line border-t border-line text-xs">
            {expectedEndpoints(version).map((e) => (
              <li key={`${e.method}${e.path}`} className="flex items-baseline gap-3 px-3.5 py-2">
                <span className="w-14 shrink-0 font-mono font-semibold text-accent-strong">{e.method}</span>
                <span className="font-mono break-all">{e.path}</span>
                <span className="ml-auto hidden text-muted sm:inline">{e.purpose}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="prefs-heading" className="space-y-3">
        <h2 id="prefs-heading" className="text-base font-semibold">
          Local preferences
        </h2>
        <p className="text-sm text-muted">
          Your API version, sidebar state, and retrieval settings are saved in this browser. Documents and credentials are never stored.
        </p>
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => {
            removeStorage(STORAGE_KEYS.retrievalConfig);
            setMessage("Retrieval settings were reset to their defaults.");
          }}
        >
          Reset retrieval settings
        </button>
        <div aria-live="polite">{message && <p className="text-sm text-muted">{message}</p>}</div>
      </section>
    </div>
  );
}
