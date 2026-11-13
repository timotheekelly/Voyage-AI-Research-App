import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { setTransport } from "../api/client";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  setTransport(null);
});
