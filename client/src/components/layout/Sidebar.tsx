import { BookOpen, ChevronsLeft, ChevronsRight, Folder, Plus, Settings, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { describeError } from "../../api/errors";
import { useConversations } from "../../context/ConversationsContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { groupByRecency } from "../../utils/format";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return <h2 className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{children}</h2>;
}

const linkBase = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors";
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `${linkBase} ${isActive ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/80 hover:bg-ink/5"}`;

function Skeleton() {
  return (
    <div className="space-y-1.5 px-2" aria-hidden="true">
      <div className="pulse-soft h-4 rounded bg-ink/10" />
      <div className="pulse-soft h-4 w-2/3 rounded bg-ink/10" />
    </div>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useWorkspace();
  const convs = useConversations();
  const groups = groupByRecency(convs.conversations);
  // On narrow screens the sidebar is an overlay and is never in the icon-only state.
  const iconOnly = collapsed && !mobileOpen;

  const newConversation = () => {
    navigate("/", { state: { fresh: Date.now() } });
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/30 md:hidden" onClick={onCloseMobile} aria-hidden="true" />}
      <aside
        aria-label="Primary"
        className={`${mobileOpen ? "fixed inset-y-0 left-0 z-40 flex w-72" : "hidden md:flex"} ${
          iconOnly ? "md:w-14" : "md:w-64"
        } shrink-0 flex-col border-r border-line bg-sidebar transition-[width]`}
      >
        <div className={`flex h-12 items-center ${iconOnly ? "justify-center" : "justify-between px-3"}`}>
          {!iconOnly && (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-white" aria-hidden="true">V</div>
              <span className="text-sm font-semibold tracking-tight">Voyage Research</span>
            </div>
          )}
          {mobileOpen ? (
            <button type="button" onClick={onCloseMobile} aria-label="Close navigation" className="rounded-md p-1.5 text-muted hover:bg-ink/5">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : <ChevronsLeft className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>

        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={newConversation}
            aria-label="New conversation"
            className={`flex w-full items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm font-medium transition-colors hover:border-accent/50 ${iconOnly ? "justify-center" : ""}`}
          >
            <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
            {!iconOnly && "New conversation"}
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
          <NavLink to="/library" className={linkClass} onClick={onCloseMobile} title="Document library">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!iconOnly && "Document library"}
          </NavLink>

          {!iconOnly && (
            <>
              <section aria-label="Research workspaces">
                <SectionLabel>Workspaces</SectionLabel>
                {ws.loading ? (
                  <Skeleton />
                ) : ws.error ? (
                  <p className="px-2 text-xs text-muted" title={describeError(ws.error)}>
                    Unavailable
                  </p>
                ) : ws.workspaces.length === 0 ? (
                  <p className="px-2 text-xs text-muted">No workspaces yet</p>
                ) : (
                  <ul className="space-y-0.5">
                    {ws.workspaces.map((w) => {
                      const active = w.id === ws.activeWorkspace?.id;
                      return (
                        <li key={w.id}>
                          <button
                            type="button"
                            aria-current={active ? "true" : undefined}
                            onClick={() => ws.setActiveWorkspaceId(w.id)}
                            title={w.name}
                            className={`${linkBase} w-full text-left ${active ? "bg-accent-soft font-medium text-accent-strong" : "text-ink/80 hover:bg-ink/5"}`}
                          >
                            <Folder className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{w.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-label="Recent conversations">
                <SectionLabel>Recent</SectionLabel>
                {convs.loading ? (
                  <Skeleton />
                ) : convs.error ? (
                  <p className="px-2 text-xs text-muted" title={describeError(convs.error)}>
                    Unavailable
                  </p>
                ) : groups.length === 0 ? (
                  <p className="px-2 text-xs text-muted">No conversations yet</p>
                ) : (
                  <div className="space-y-3">
                    {groups.map((g) => (
                      <div key={g.label}>
                        <h3 className="px-2 pb-0.5 text-xs text-muted">{g.label}</h3>
                        <ul>
                          {g.items.map((c) => (
                            <li key={c.id}>
                              <NavLink to={`/c/${encodeURIComponent(c.id)}`} className={linkClass} title={c.title} onClick={onCloseMobile}>
                                <span className="truncate">{c.title}</span>
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </nav>

        <div className="border-t border-line p-2">
          <NavLink
            to="/settings"
            title="Settings"
            onClick={onCloseMobile}
            className={({ isActive }) => `${linkClass({ isActive })} ${iconOnly ? "justify-center" : ""}`}
            state={location.state}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!iconOnly && "Settings"}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
