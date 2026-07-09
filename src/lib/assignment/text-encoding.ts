import { Buffer } from "node:buffer";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const gb18030Decoder = new TextDecoder("gb18030");

const commonVietnameseLatin1Letters = new Set(
  Array.from("ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúý")
);

function decodeUtf8Strict(buffer: Uint8Array) {
  try {
    return utf8Decoder.decode(buffer);
  } catch {
    return null;
  }
}

function countCjkCharacters(value: string) {
  return Array.from(value).filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
}

function shouldTryGb18030Repair(value: string) {
  return Array.from(value).some((char) => !commonVietnameseLatin1Letters.has(char));
}

function repairGb18030AsLatin1(value: string) {
  return value.replace(/[\u00a1-\u00ff]{2,}/g, (match) => {
    if (!shouldTryGb18030Repair(match)) {
      return match;
    }

    const bytes = Uint8Array.from(Array.from(match, (char) => char.charCodeAt(0)));
    const repaired = gb18030Decoder.decode(bytes);

    if (repaired.includes("\uFFFD") || countCjkCharacters(repaired) === 0) {
      return match;
    }

    return repaired;
  });
}

export function repairTextMojibake(value: string) {
  return repairGb18030AsLatin1(value);
}

export function decodeTextBuffer(buffer: Uint8Array) {
  const utf8Text = decodeUtf8Strict(buffer);
  const decoded = utf8Text ?? gb18030Decoder.decode(buffer);

  return repairTextMojibake(decoded);
}

export function decodeRtfSourceBuffer(buffer: Uint8Array) {
  return Buffer.from(buffer).toString("latin1");
}
