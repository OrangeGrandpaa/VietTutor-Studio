import { describe, expect, it } from "vitest";

import { buildSpeakingFallback, buildWritingFallback } from "@/lib/ai/fallback";

describe("AI fallbacks", () => {
  it("builds a writing fallback without deprecated summary fields", () => {
    const result = buildWritingFallback("# Title\n\n1. Hello");

    expect(result.assignment_type).toBe("writing");
    expect(result.parts.length).toBeGreaterThan(0);
    expect("ai_summary" in result).toBe(false);
    expect("suggested_review_points" in result).toBe(false);
  });

  it("builds a speaking fallback without deprecated suggestion fields", () => {
    const result = buildSpeakingFallback("Short line\n\nAnother paragraph");

    expect(result.assignment_type).toBe("speaking");
    expect(result.units.length).toBeGreaterThan(0);
    expect("ai_summary" in result).toBe(false);
    expect("practice_suggestions" in result).toBe(false);
  });
});
