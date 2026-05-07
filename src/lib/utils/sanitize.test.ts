import { describe, expect, it } from "vitest";

import { sanitizeOptionalText, sanitizeText } from "@/lib/utils/sanitize";

describe("sanitize utils", () => {
  it("trims text and removes null bytes", () => {
    expect(sanitizeText(" \u0000hello \n")).toBe("hello");
  });

  it("returns null for empty optional text", () => {
    expect(sanitizeOptionalText("   ")).toBeNull();
    expect(sanitizeOptionalText(null)).toBeNull();
  });
});
