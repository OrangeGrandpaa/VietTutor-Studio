import "server-only";

import mammoth from "mammoth";
import path from "node:path";
import WordExtractor from "word-extractor";

import { extractTextWithKimiFilesApi } from "@/lib/ai/kimi";

const wordExtractor = new WordExtractor();

const LOCAL_TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".doc", ".docx"]);
const KIMI_FILE_EXTRACT_EXTENSIONS = new Set([
  ".pdf",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".html",
  ".htm",
  ".json",
  ".xml",
  ".log"
]);

export const assignmentUploadConfig = {
  allowedExtensions: [...LOCAL_TEXT_EXTENSIONS, ...KIMI_FILE_EXTRACT_EXTENSIONS],
  allowedMimeTypes: [
    "text/markdown",
    "text/plain",
    "text/csv",
    "text/html",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/json",
    "application/xml",
    "text/xml"
  ]
} as const;

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function isTextMimeType(mimeType: string) {
  return mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml";
}

async function extractLocalText(file: File, extension: string, mimeType: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeLineBreaks(result.value);
  }

  if (extension === ".doc") {
    const result = await wordExtractor.extract(buffer);
    return normalizeLineBreaks(result.getBody());
  }

  if (LOCAL_TEXT_EXTENSIONS.has(extension) || isTextMimeType(mimeType)) {
    return normalizeLineBreaks(buffer.toString("utf-8"));
  }

  return "";
}

export async function extractAssignmentSourceText(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (LOCAL_TEXT_EXTENSIONS.has(extension) || isTextMimeType(mimeType)) {
    const text = await extractLocalText(file, extension, mimeType);

    if (!text) {
      throw new Error("文件中没有读取到可用文本内容。");
    }

    return {
      text,
      strategy: "local-direct" as const
    };
  }

  if (KIMI_FILE_EXTRACT_EXTENSIONS.has(extension)) {
    const text = normalizeLineBreaks(await extractTextWithKimiFilesApi(file));

    if (!text) {
      throw new Error("Kimi Files API 没有返回可用文本内容。");
    }

    return {
      text,
      strategy: "kimi-files" as const
    };
  }

  throw new Error("当前文件类型不支持用于作业结构化。");
}
