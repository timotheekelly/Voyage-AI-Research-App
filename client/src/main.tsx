import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setTransport } from "./api/client";
import { isMockApiEnabled } from "./config/apiVersions";
import "./index.css";

async function bootstrap() {
  // Mock mode is explicit and opt-in; it is never enabled as a fallback when requests fail.
  if (isMockApiEnabled()) {
    const { mockTransport } = await import("./mocks/mockApi");
    setTransport(mockTransport);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
