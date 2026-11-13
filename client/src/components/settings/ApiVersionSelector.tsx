import { API_VERSION_INFO } from "../../config/apiVersions";
import { useApiVersion } from "../../hooks/useApiVersion";

export function ApiVersionSelector() {
  const { version, setVersion } = useApiVersion();
  return (
    <fieldset>
      <legend className="text-base font-semibold">API version</legend>
      <p className="mt-1 mb-4 text-sm text-muted">
        Each version adds retrieval capabilities. Switching changes the API routes and the controls shown in chat.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="API version">
        {API_VERSION_INFO.map((v) => (
          <label
            key={v.id}
            className="relative flex cursor-pointer gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-muted/50 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name="api-version"
              value={v.id}
              checked={version === v.id}
              onChange={() => setVersion(v.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#426B55]"
            />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-accent-strong">{v.label}</span>
                <span className="text-sm font-medium">{v.name}</span>
              </span>
              <span className="mt-0.5 block text-xs font-medium text-ink/80">{v.capability}</span>
              <span className="mt-1 block text-xs text-muted">{v.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
