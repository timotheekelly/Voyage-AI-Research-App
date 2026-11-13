import { describe, expect, it } from "vitest";
import { linkifyCitations, parseCitationHref } from "./citations";

describe("linkifyCitations", () => {
  it("links markers that map to a citation", () => {
    expect(linkifyCitations("Found it [1] and [2].", 2)).toBe("Found it [[1]](#cite-1) and [[2]](#cite-2).");
  });
  it("leaves out-of-range markers, markdown links, and code untouched", () => {
    expect(linkifyCitations("See [3] and [a](http://x) `arr[1]`", 2)).toBe("See [3] and [a](http://x) `arr[1]`");
    expect(linkifyCitations("```\nx[1]\n```", 2)).toBe("```\nx[1]\n```");
  });
  it("is a no-op without citations", () => {
    expect(linkifyCitations("text [1]", 0)).toBe("text [1]");
  });
  it("parses citation hrefs", () => {
    expect(parseCitationHref("#cite-4")).toBe(4);
    expect(parseCitationHref("https://x")).toBeNull();
  });
});
