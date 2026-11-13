import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { useConnection } from "../../context/ConnectionContext";
import { STORAGE_KEYS, readStorage, writeStorage } from "../../utils/storage";
import { CitationPanel } from "../citations/CitationPanel";
import { ERROR_MESSAGES } from "../../api/errors";
import { Notice } from "../common/Notice";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => readStorage(STORAGE_KEYS.sidebarCollapsed) === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status, retry, mockMode } = useConnection();

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      writeStorage(STORAGE_KEYS.sidebarCollapsed, String(!c));
      return !c;
    });
  }, []);

  return (
    <div className="flex h-full bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-surface focus:px-3 focus:py-1.5">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        {status === "unavailable" && !mockMode && (
          <div className="border-b border-line px-4 py-2">
            <Notice tone="warn" onRetry={retry}>
              {ERROR_MESSAGES.NETWORK_ERROR}
            </Notice>
          </div>
        )}
        <main id="main" className="min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <CitationPanel />
    </div>
  );
}
