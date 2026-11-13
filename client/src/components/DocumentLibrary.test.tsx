import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setTransport } from "../api/client";
import { DocumentLibrary } from "./documents/DocumentLibrary";
import { ok, renderWithProviders, routeTransport } from "../test/utils";

const base = {
  "GET /workspaces": () => ok([]),
  "GET /conversations": () => ok([]),
  "GET /documents": () => ok([]),
};
const pdf = () => new File(["%PDF-1.4 test"], "paper.pdf", { type: "application/pdf" });

describe("document upload", () => {
  it("tells the user when the upload endpoint does not exist, and adds nothing to the library", async () => {
    const { transport } = routeTransport({ ...base, "POST /documents": () => ({ status: 404, body: undefined }) });
    setTransport(transport);
    const user = userEvent.setup();
    renderWithProviders(<DocumentLibrary />);
    await screen.findByText("No documents yet");

    await user.upload(screen.getByLabelText("Upload documents"), pdf());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Upload failed");
    expect(alert).toHaveTextContent("This feature is not available in the selected API version yet.");
    expect(screen.getByText("No documents yet")).toBeInTheDocument(); // never pretended it succeeded
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("reports a network failure during upload", async () => {
    const { transport } = routeTransport({
      ...base,
      "POST /documents": () => {
        throw new TypeError("offline");
      },
    });
    setTransport(transport);
    const user = userEvent.setup();
    renderWithProviders(<DocumentLibrary />);
    await screen.findByText("No documents yet");
    await user.upload(screen.getByLabelText("Upload documents"), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect to the research API");
  });

  it("rejects unsupported file types without calling the API", async () => {
    const { transport, calls } = routeTransport(base);
    setTransport(transport);
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<DocumentLibrary />);
    await screen.findByText("No documents yet");
    await user.upload(screen.getByLabelText("Upload documents"), new File(["x"], "virus.exe"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("adds a document only after the backend confirms the upload", async () => {
    const { transport } = routeTransport({
      ...base,
      "POST /documents": () => ({ status: 201, body: { id: "d1", title: "paper", processingStatus: "PROCESSING", filename: "paper.pdf" } }),
    });
    setTransport(transport);
    const user = userEvent.setup();
    renderWithProviders(<DocumentLibrary />);
    await screen.findByText("No documents yet");
    await user.upload(screen.getByLabelText("Upload documents"), pdf());
    expect(await screen.findByText("paper")).toBeInTheDocument();
    expect(screen.queryByText("No documents yet")).not.toBeInTheDocument();
  });
});

describe("document library states", () => {
  it("shows an unavailable state with retry when the backend is down, without fake documents", async () => {
    setTransport(async () => {
      throw new TypeError("offline");
    });
    renderWithProviders(<DocumentLibrary />);
    expect(await screen.findByText("Documents are unavailable")).toBeInTheDocument();
    expect(screen.getAllByText(/Unable to connect/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });

  it("requires confirmation before deleting, and removes the row only after the backend confirms", async () => {
    let deleted = false;
    const { transport } = routeTransport({
      ...base,
      "GET /documents": () => ok([{ id: "d1", title: "Doc One", processingStatus: "READY" }]),
      "DELETE /documents/d1": () => {
        deleted = true;
        return { status: 204, body: undefined };
      },
    });
    setTransport(transport);
    const user = userEvent.setup();
    renderWithProviders(<DocumentLibrary />);
    await user.click(await screen.findByRole("button", { name: "Delete Doc One" }));
    const dialog = screen.getByRole("alertdialog");
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Doc One")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Doc One" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Doc One")).not.toBeInTheDocument());
    expect(deleted).toBe(true);
  });

  it("keeps the row and shows an error if deletion fails", async () => {
    const { transport } = routeTransport({
      ...base,
      "GET /documents": () => ok([{ id: "d1", title: "Doc One", processingStatus: "READY" }]),
      "DELETE /documents/d1": () => ({ status: 500, body: undefined }),
    });
    setTransport(transport);
    const user = userEvent.setup();
    renderWithProviders(<DocumentLibrary />);
    await user.click(await screen.findByRole("button", { name: "Delete Doc One" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The research service encountered an error");
    expect(screen.getByText("Doc One")).toBeInTheDocument();
  });
});
