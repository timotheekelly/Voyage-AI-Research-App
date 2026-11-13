import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type { Transport, TransportRequest, TransportResponse } from "../api/client";
import { AppProviders } from "../App";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AppProviders>{children}</AppProviders>
    </MemoryRouter>
  );
}

export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}

export type Handler = (req: TransportRequest) => TransportResponse | Promise<TransportResponse>;

/** Builds a transport from "METHOD /path-suffix" handlers. Unmatched routes return 404. */
export function routeTransport(routes: Record<string, Handler>): { transport: Transport; calls: TransportRequest[] } {
  const calls: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    calls.push(req);
    const suffix = req.path.replace(/^\/api\/v\d/, "");
    const handler = routes[`${req.method} ${suffix}`];
    return handler ? handler(req) : { status: 404, body: undefined };
  };
  return { transport, calls };
}

export const ok = (body: unknown): TransportResponse => ({ status: 200, body });
