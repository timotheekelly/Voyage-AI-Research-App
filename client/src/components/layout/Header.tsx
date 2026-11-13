import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useApiVersion } from "../../hooks/useApiVersion";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useConnection } from "../../context/ConnectionContext";
import { getVersionInfo } from "../../config/apiVersions";
import { ConnectionStatus } from "./ConnectionStatus";

interface Props {
  onOpenMobileNav: () => void;
}

export function Header({ onOpenMobileNav }: Props) {
  const { version } = useApiVersion();
  const { activeWorkspace } = useWorkspace();
  const { mockMode } = useConnection();
  const info = getVersionInfo(version);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-1 rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink md:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1 truncate text-sm text-muted">
        {activeWorkspace ? <span className="text-ink">{activeWorkspace.name}</span> : "No workspace selected"}
      </div>
      {mockMode && (
        <span
          className="rounded-full border border-warn/30 bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
          title="Responses are sample data, not from a real backend."
        >
          Demo Mode
        </span>
      )}
      <ConnectionStatus />
      <Link
        to="/settings"
        title={`${info.name}: ${info.capability}`}
        className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink transition-colors hover:border-accent/50"
      >
        API {version.toUpperCase()}
      </Link>
    </header>
  );
}
