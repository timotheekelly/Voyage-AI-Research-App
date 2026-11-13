import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ApiVersionProvider } from "./context/ApiVersionContext";
import { CitationProvider } from "./context/CitationContext";
import { ConnectionProvider } from "./context/ConnectionContext";
import { ConversationsProvider } from "./context/ConversationsContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ChatPage } from "./pages/ChatPage";
import { LibraryPage } from "./pages/LibraryPage";
import { SettingsPage } from "./pages/SettingsPage";

function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/" className="text-sm text-accent underline">
        Back to chat
      </Link>
    </div>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ApiVersionProvider>
      <ConnectionProvider>
        <WorkspaceProvider>
          <ConversationsProvider>
            <CitationProvider>{children}</CitationProvider>
          </ConversationsProvider>
        </WorkspaceProvider>
      </ConnectionProvider>
    </ApiVersionProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ChatPage />} />
        <Route path="c/:conversationId" element={<ChatPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
