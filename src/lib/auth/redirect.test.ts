import { describe, expect, it } from "vitest";

import { resolveLoginRedirect } from "@/lib/auth/redirect";

describe("resolveLoginRedirect", () => {
  it("keeps internal absolute paths", () => {
    expect(resolveLoginRedirect("/dashboard")).toBe("/dashboard");
    expect(resolveLoginRedirect("/assignments/writing/a1?wrongOnly=1#review")).toBe(
      "/assignments/writing/a1?wrongOnly=1#review"
    );
  });

  it.each([
    null,
    "",
    "dashboard",
    "//evil.example/path",
    "/\\evil.example/path",
    "https://evil.example/path",
    "javascript:alert(1)",
    " /dashboard",
    "/dashboard\\evil"
  ])("falls back for an unsafe next value: %s", (candidate) => {
    expect(resolveLoginRedirect(candidate)).toBe("/dashboard");
  });

  it("supports an explicit fallback", () => {
    expect(resolveLoginRedirect("https://evil.example", "/")).toBe("/");
  });
});
