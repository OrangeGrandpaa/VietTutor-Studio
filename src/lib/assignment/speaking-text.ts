import type { SpeakingStructuredContent } from "@/types/assignment";

const sentenceEndPattern = /[^.;。；!?！？]+[.;。；!?！？]+/g;

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

export function buildSpeakingTextAssignment(params: {
  text: string;
  title: string;
}): SpeakingStructuredContent {
  const sentences = splitSpeakingSentences(params.text);

  if (sentences.length === 0) {
    throw new Error("TXT 中没有识别到可互动句子。请至少使用 ; 或 . 作为句子结尾。");
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
