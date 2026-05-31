import type { SpeakingStructuredContent } from "@/types/assignment";

const sentenceEndPattern = /[^.;。；!?！？]+[.;。；!?！？]+/g;
const skippableRtfDestinations = new Set([
  "colortbl",
  "datastore",
  "filetbl",
  "fonttbl",
  "footer",
  "footerf",
  "footerl",
  "footerr",
  "generator",
  "header",
  "headerf",
  "headerl",
  "headerr",
  "info",
  "listoverridetable",
  "listtable",
  "object",
  "pict",
  "revtbl",
  "stylesheet"
]);

function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function splitSpeakingSentences(text: string) {
  const normalized = normalizeText(text);
  const matches = normalized.match(sentenceEndPattern) ?? [];

  return matches
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function peekRtfGroupDestination(text: string, startIndex: number) {
  let cursor = startIndex;
  let isIgnorableDestination = false;

  while (/\s/.test(text[cursor] ?? "")) {
    cursor += 1;
  }

  if (text[cursor] === "\\" && text[cursor + 1] === "*") {
    isIgnorableDestination = true;
    cursor += 2;
  }

  while (/\s/.test(text[cursor] ?? "")) {
    cursor += 1;
  }

  if (text[cursor] !== "\\") {
    return { destination: "", isIgnorableDestination };
  }

  cursor += 1;
  const wordStart = cursor;

  while (/[A-Za-z]/.test(text[cursor] ?? "")) {
    cursor += 1;
  }

  return {
    destination: text.slice(wordStart, cursor),
    isIgnorableDestination
  };
}

function parseRtfControlWord(text: string, startIndex: number) {
  let cursor = startIndex;
  const wordStart = cursor;

  while (/[A-Za-z]/.test(text[cursor] ?? "")) {
    cursor += 1;
  }

  const word = text.slice(wordStart, cursor);
  let sign = 1;

  if (text[cursor] === "-") {
    sign = -1;
    cursor += 1;
  }

  const numberStart = cursor;
  while (/\d/.test(text[cursor] ?? "")) {
    cursor += 1;
  }

  const rawParam = text.slice(numberStart, cursor);
  const param = rawParam ? sign * Number(rawParam) : null;

  if (text[cursor] === " ") {
    cursor += 1;
  }

  return { word, param, nextIndex: cursor };
}

function skipRtfFallback(text: string, startIndex: number, count: number) {
  let cursor = startIndex;

  for (let skipped = 0; skipped < count && cursor < text.length; skipped += 1) {
    if (text[cursor] === "\\" && text[cursor + 1] === "'") {
      cursor += 4;
      continue;
    }

    if (text[cursor] === "\\" && "{}\\".includes(text[cursor + 1] ?? "")) {
      cursor += 2;
      continue;
    }

    cursor += 1;
  }

  return cursor;
}

function decodeRtfUnicodeParam(param: number) {
  const codeUnit = param < 0 ? param + 65536 : param;
  return String.fromCharCode(codeUnit);
}

export function extractPlainTextFromRtf(rtf: string) {
  let output = "";
  let cursor = 0;
  let unicodeFallbackChars = 1;
  const skipStack = [false];

  while (cursor < rtf.length) {
    const char = rtf[cursor];
    const shouldSkip = skipStack[skipStack.length - 1] ?? false;

    if (char === "{") {
      const { destination, isIgnorableDestination } = peekRtfGroupDestination(rtf, cursor + 1);
      skipStack.push(
        shouldSkip || isIgnorableDestination || skippableRtfDestinations.has(destination)
      );
      cursor += 1;
      continue;
    }

    if (char === "}") {
      if (skipStack.length > 1) {
        skipStack.pop();
      }
      cursor += 1;
      continue;
    }

    if (char !== "\\") {
      if (!shouldSkip) {
        output += char;
      }
      cursor += 1;
      continue;
    }

    const next = rtf[cursor + 1];

    if (!next) {
      cursor += 1;
      continue;
    }

    if ("{}\\".includes(next)) {
      if (!shouldSkip) {
        output += next;
      }
      cursor += 2;
      continue;
    }

    if (next === "'") {
      if (!shouldSkip) {
        const byte = Number.parseInt(rtf.slice(cursor + 2, cursor + 4), 16);
        if (Number.isFinite(byte)) {
          output += String.fromCharCode(byte);
        }
      }
      cursor += 4;
      continue;
    }

    if (!/[A-Za-z]/.test(next)) {
      if (!shouldSkip && next === "~") {
        output += " ";
      }
      cursor += 2;
      continue;
    }

    const control = parseRtfControlWord(rtf, cursor + 1);
    cursor = control.nextIndex;

    if (shouldSkip) {
      continue;
    }

    switch (control.word) {
      case "emdash":
        output += "--";
        break;
      case "endash":
        output += "-";
        break;
      case "line":
      case "par":
        output += "\n";
        break;
      case "lquote":
      case "rquote":
        output += "'";
        break;
      case "ldblquote":
      case "rdblquote":
        output += "\"";
        break;
      case "tab":
        output += "\t";
        break;
      case "uc":
        unicodeFallbackChars = Math.max(0, control.param ?? unicodeFallbackChars);
        break;
      case "u":
        if (control.param !== null) {
          output += decodeRtfUnicodeParam(control.param);
          cursor = skipRtfFallback(rtf, cursor, unicodeFallbackChars);
        }
        break;
      default:
        break;
    }
  }

  return output
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildSpeakingTextAssignment(params: {
  text: string;
  title: string;
}): SpeakingStructuredContent {
  const sentences = splitSpeakingSentences(params.text);

  if (sentences.length === 0) {
    throw new Error("文件中没有识别到可互动句子。请至少使用 ; 或 . 作为句子结尾。");
  }

  return {
    title: params.title,
    assignment_type: "speaking",
    units: sentences.map((content, index) => ({
      unit_type: "sentence",
      content,
      order_index: index + 1
    }))
  };
}
