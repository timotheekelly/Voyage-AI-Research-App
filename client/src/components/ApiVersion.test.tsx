import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Header } from "./layout/Header";
import { SettingsPage } from "../pages/SettingsPage";
import { routeTransport, ok, renderWithProviders } from "../test/utils";
import { setTransport } from "../api/client";
import { STORAGE_KEYS } from "../utils/storage";

function offline() {
  setTransport(async () => {
    throw new TypeError("offline");
  });
}

describe("API version selection", () => {
  it("defaults to V1 for new users", () => {
    offline();
    renderWithProviders(<><Header onOpenMobileNav={() => undefined} /><SettingsPage /></>);
    expect(screen.getByRole("radio", { name: /V1\s*Foundations/ })).toBeChecked();
    expect(screen.getByText("API V1")).toBeInTheDocument();
  });

  it("switches, persists to localStorage, and updates the header indicator", async () => {
    offline();
    const user = userEvent.setup();
    renderWithProviders(<><Header onOpenMobileNav={() => undefined} /><SettingsPage /></>);
    await user.click(screen.getByRole("radio", { name: /V3\s*Reranking/ }));
    expect(window.localStorage.getItem(STORAGE_KEYS.apiVersion)).toBe("v3");
    expect(screen.getByText("API V3")).toBeInTheDocument();
  });

  it("restores the stored version and ignores invalid stored values", () => {
    offline();
    window.localStorage.setItem(STORAGE_KEYS.apiVersion, "v4");
    const { unmount } = renderWithProviders(<Header onOpenMobileNav={() => undefined} />);
    expect(screen.getByText("API V4")).toBeInTheDocument();
    unmount();
    window.localStorage.setItem(STORAGE_KEYS.apiVersion, "v99");
    renderWithProviders(<Header onOpenMobileNav={() => undefined} />);
    expect(screen.getByText("API V1")).toBeInTheDocument();
  });

  it("refetches workspaces from the new version's route after switching", async () => {
    const { transport, calls } = routeTransport({ "GET /workspaces": () => ok([]) });
    setTransport(transport);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await user.click(screen.getByRole("radio", { name: /V2\s*Hybrid/ }));
    await screen.findByText("Expected endpoints for V2");
    const paths = calls.filter((c) => c.path.endsWith("/workspaces")).map((c) => c.path);
    expect(paths).toContain("/api/v1/workspaces");
    expect(paths).toContain("/api/v2/workspaces");
  });
});
