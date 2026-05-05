import {
  DisplayType,
  MaterialCategory,
  MaterialFileType,
  SpeakingUnitType
} from "@prisma/client";

export function mapDisplayType(type: string | undefined | null) {
  switch ((type ?? "").toLowerCase()) {
    case "sentence":
      return DisplayType.SENTENCE;
    case "dialogue":
      return DisplayType.DIALOGUE;
    case "essay":
      return DisplayType.ESSAY;
    case "vocabulary":
      return DisplayType.VOCABULARY;
    default:
      return DisplayType.PARAGRAPH;
  }
}

export function mapSpeakingUnitType(type: string | undefined | null) {
  switch ((type ?? "").toLowerCase()) {
    case "word":
      return SpeakingUnitType.WORD;
    case "phrase":
      return SpeakingUnitType.PHRASE;
    case "sentence":
      return SpeakingUnitType.SENTENCE;
    case "article":
      return SpeakingUnitType.ARTICLE;
    case "dialogue":
      return SpeakingUnitType.DIALOGUE;
    default:
      return SpeakingUnitType.PARAGRAPH;
  }
}

export function inferMaterialFileType(fileName: string, mimeType?: string | null) {
  const lower = fileName.toLowerCase();
  const mime = mimeType?.toLowerCase() ?? "";

  if (lower.endsWith(".pdf") || mime.includes("pdf")) return MaterialFileType.PDF;
  if (lower.endsWith(".doc") || lower.endsWith(".docx") || mime.includes("word")) return MaterialFileType.WORD;
  if (
    lower.endsWith(".ppt") ||
    lower.endsWith(".pptx") ||
    mime.includes("presentation") ||
    mime.includes("powerpoint")
  ) {
    return MaterialFileType.POWERPOINT;
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || mime.includes("markdown") || mime.includes("text/plain")) {
    return MaterialFileType.MARKDOWN;
  }
  if (mime.startsWith("image/")) return MaterialFileType.IMAGE;
  if (mime.startsWith("audio/")) return MaterialFileType.AUDIO;
  if (mime.startsWith("video/")) return MaterialFileType.VIDEO;
  return MaterialFileType.OTHER;
}

export function mapMaterialCategory(value: string) {
  switch (value) {
    case "PRONUNCIATION":
      return MaterialCategory.PRONUNCIATION;
    case "VOCABULARY":
      return MaterialCategory.VOCABULARY;
    case "GRAMMAR":
      return MaterialCategory.GRAMMAR;
    case "LISTENING":
      return MaterialCategory.LISTENING;
    case "SPEAKING":
      return MaterialCategory.SPEAKING;
    case "READING":
      return MaterialCategory.READING;
    case "WRITING":
      return MaterialCategory.WRITING;
    default:
      return MaterialCategory.INTEGRATED;
  }
}
