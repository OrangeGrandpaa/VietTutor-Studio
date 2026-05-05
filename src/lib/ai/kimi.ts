import "server-only";

import { z } from "zod";

import { speakingAssignmentStructurePrompt } from "@/prompts/speaking-assignment-structure.prompt";
import { writingAssignmentStructurePrompt } from "@/prompts/writing-assignment-structure.prompt";
import { getEnv } from "@/lib/utils/env";
import type { SpeakingStructuredContent, WritingStructuredContent } from "@/types/assignment";

const STRUCTURED_OUTPUT_MAX_TOKENS = 8192;
const KIMI_FILE_EXTRACTION_MAX_POLLS = 10;
const KIMI_FILE_EXTRACTION_POLL_INTERVAL_MS = 1200;

const writingSchema = z.object({
  title: z.string().default("未命名笔头作业"),
  assignment_type: z.literal("writing"),
  parts: z
    .array(
      z.object({
        part_title: z.string().default("题目列表"),
        instruction: z.string().default(""),
        questions: z.array(
          z.object({
            question_number: z.number().int().positive(),
            prompt: z.string().default(""),
            answer: z.string().default(""),
            detected_level: z.string().default(""),
            suggested_display_type: z.enum([
              "sentence",
              "paragraph",
              "dialogue",
              "essay",
              "vocabulary"
            ])
          })
        )
      })
    )
    .default([]),
  ai_summary: z.string().default(""),
  suggested_review_points: z.array(z.string()).default([])
});

const speakingSchema = z.object({
  title: z.string().default("未命名口语作业"),
  assignment_type: z.literal("speaking"),
  units: z.array(
    z.object({
      unit_type: z.enum(["word", "phrase", "sentence", "paragraph", "article", "dialogue"]),
      content: z.string().default(""),
      order_index: z.number().int().positive()
    })
  ),
  ai_summary: z.string().default(""),
  practice_suggestions: z.array(z.string()).default([])
});

function getKimiConfig() {
  return {
    apiKey: getEnv("KIMI_API_KEY"),
    baseUrl: getEnv("KIMI_BASE_URL", "https://api.moonshot.cn/v1").replace(/\/$/, ""),
    model: getEnv("KIMI_MODEL", "kimi-k2.6")
  };
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI 返回内容不是有效 JSON。");
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function parseJsonResponse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(extractJsonBlock(text));
  }
}

async function readKimiError(response: Response) {
  const errorText = await response.text();
  let detail = errorText.slice(0, 500);

  try {
    const parsed = JSON.parse(errorText) as {
      error?: {
        type?: string;
        message?: string;
      };
    };

    if (parsed.error?.message) {
      detail = parsed.error.type
        ? `${parsed.error.type}: ${parsed.error.message}`
        : parsed.error.message;
    }
  } catch {}

  return detail;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type KimiFileMetadata = {
  id: string;
  status?: string;
};

async function fetchKimiFileMetadata(fileId: string) {
  const { apiKey, baseUrl } = getKimiConfig();
  const response = await fetch(`${baseUrl}/files/${fileId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await readKimiError(response);
    throw new Error(`Kimi Files API metadata error (${response.status}): ${detail}`);
  }

  return (await response.json()) as KimiFileMetadata;
}

async function fetchKimiFileContent(fileId: string) {
  const { apiKey, baseUrl } = getKimiConfig();
  const response = await fetch(`${baseUrl}/files/${fileId}/content`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    cache: "no-store"
  });

  if (response.ok) {
    return response.text();
  }

  return {
    status: response.status,
    detail: await readKimiError(response)
  };
}

export async function extractTextWithKimiFilesApi(file: File) {
  const { apiKey, baseUrl } = getKimiConfig();
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("purpose", "file-extract");

  const uploadResponse = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData,
    cache: "no-store"
  });

  if (!uploadResponse.ok) {
    const detail = await readKimiError(uploadResponse);
    throw new Error(`Kimi Files API upload error (${uploadResponse.status}): ${detail}`);
  }

  const uploaded = (await uploadResponse.json()) as KimiFileMetadata;

  if (!uploaded.id) {
    throw new Error("Kimi Files API 未返回 file id。");
  }

  for (let attempt = 0; attempt < KIMI_FILE_EXTRACTION_MAX_POLLS; attempt += 1) {
    const contentResult = await fetchKimiFileContent(uploaded.id);

    if (typeof contentResult === "string") {
      return contentResult;
    }

    const metadata = await fetchKimiFileMetadata(uploaded.id);
    const status = metadata.status?.toLowerCase();

    if (status && ["failed", "error", "cancelled"].includes(status)) {
      throw new Error(`Kimi Files API 提取失败（status=${metadata.status}）。`);
    }

    if (attempt === KIMI_FILE_EXTRACTION_MAX_POLLS - 1) {
      throw new Error(
        `Kimi Files API 提取超时（status=${metadata.status ?? "unknown"}，detail=${contentResult.detail}）。`
      );
    }

    await delay(KIMI_FILE_EXTRACTION_POLL_INTERVAL_MS);
  }

  throw new Error("Kimi Files API 提取超时。");
}

export async function callKimiModel(prompt: string, input: string) {
  const { apiKey, baseUrl, model } = getKimiConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: STRUCTURED_OUTPUT_MAX_TOKENS,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: input
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await readKimiError(response);
    throw new Error(`Kimi API error (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string };
    }>;
  };

  const choice = payload.choices?.[0];
  const finishReason = choice?.finish_reason;
  const content = choice?.message?.content;

  if (!choice) {
    throw new Error("Kimi API 未返回 choices，无法解析结构化结果。");
  }

  if (finishReason === "length") {
    throw new Error(
      `Kimi API 返回被截断（finish_reason=length）。请缩短输入内容，或进一步增大 max_tokens（当前 ${STRUCTURED_OUTPUT_MAX_TOKENS}）。`
    );
  }

  if (!content) {
    throw new Error(
      `Kimi API 未返回可解析内容${finishReason ? `（finish_reason=${finishReason}）` : ""}。`
    );
  }

  return content;
}

export async function structureWritingAssignment(markdownContent: string) {
  const raw = await callKimiModel(
    writingAssignmentStructurePrompt,
    `以下是上传的笔头作业题目内容，请按部分和题目进行结构化整理：\n\n${markdownContent}`
  );

  const parsed = parseJsonResponse(raw);
  return writingSchema.parse(parsed) as WritingStructuredContent;
}

export async function structureSpeakingAssignment(markdownContent: string) {
  const raw = await callKimiModel(
    speakingAssignmentStructurePrompt,
    `以下是上传的口语练习内容，请结构化整理：\n\n${markdownContent}`
  );

  const parsed = parseJsonResponse(raw);
  return speakingSchema.parse(parsed) as SpeakingStructuredContent;
}
