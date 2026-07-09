import { describe, expect, it } from "vitest";

import { decodeTextBuffer, repairTextMojibake } from "@/lib/assignment/text-encoding";

describe("assignment text encoding helpers", () => {
  it("decodes GBK/GB18030 Chinese text when UTF-8 decoding fails", () => {
    const gbkBytes = Buffer.from([0xc4, 0xd1, 0xca, 0xdc]);

    expect(decodeTextBuffer(gbkBytes)).toBe("难受");
  });

  it("keeps valid UTF-8 Vietnamese and Chinese text unchanged", () => {
    const text = "Tác giả cảm thấy khó chịu：难受";

    expect(decodeTextBuffer(Buffer.from(text, "utf-8"))).toBe(text);
  });

  it("repairs Chinese GBK bytes that were interpreted as Latin-1 text", () => {
    expect(repairTextMojibake("答案：ÄÑÊÜ")).toBe("答案：难受");
  });

  it("does not rewrite normal Vietnamese accent text as Chinese", () => {
    const text = "Tác giả cảm thấy thế nào?";

    expect(repairTextMojibake(text)).toBe(text);
  });
});
