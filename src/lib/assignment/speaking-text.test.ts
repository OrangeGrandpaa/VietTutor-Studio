import { describe, expect, it } from "vitest";

import { buildSpeakingTextAssignment, extractPlainTextFromRtf } from "@/lib/assignment/speaking-text";

describe("speaking text helpers", () => {
  it("extracts readable text from common RTF content", () => {
    const rtf = String.raw`{\rtf1\ansi\uc1{\fonttbl{\f0 Arial;}}\f0 Xin ch\u224?o.\par H\u244?m nay;}`;

    expect(extractPlainTextFromRtf(rtf)).toBe("Xin chào.\nHôm nay;");
  });

  it("builds speaking sentence units from RTF-extracted text", () => {
    const text = extractPlainTextFromRtf(String.raw`{\rtf1\ansi\uc1\f0 Xin ch\u224?o.\par H\u244?m nay;}`);
    const result = buildSpeakingTextAssignment({ text, title: "口语练习" });

    expect(result.units).toEqual([
      {
        unit_type: "sentence",
        content: "Xin chào.",
        order_index: 1
      },
      {
        unit_type: "sentence",
        content: "Hôm nay;",
        order_index: 2
      }
    ]);
  });

  it("keeps trailing text when the final sentence has no punctuation", () => {
    const result = buildSpeakingTextAssignment({
      text: "Xin chào. Câu cuối không có dấu",
      title: "口语练习"
    });

    expect(result.units.map((unit) => unit.content)).toEqual([
      "Xin chào.",
      "Câu cuối không có dấu"
    ]);
  });
});
