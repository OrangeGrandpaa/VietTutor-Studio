import matter from "gray-matter";

import type { SpeakingStructuredContent, WritingStructuredContent } from "@/types/assignment";

function extractParagraphs(markdown: string) {
  const parsed = matter(markdown);
  return parsed.content
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitQuestionBlocks(markdown: string) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isQuestionStart =
      /^#{1,6}\s+/.test(line) ||
      /^\d+[\.\)]\s+/.test(line) ||
      /^[A-Za-z][\.\)]\s+/.test(line) ||
      /^[-*]\s+/.test(line);

    if (isQuestionStart && current.length > 0) {
      blocks.push(current.join("\n").trim());
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    blocks.push(current.join("\n").trim());
  }

  return blocks.filter(Boolean);
}

export function buildWritingFallback(markdown: string): WritingStructuredContent {
  const parsed = matter(markdown);
  const questions = splitQuestionBlocks(parsed.content).map((block, index) => ({
    question_number: index + 1,
    prompt: block,
    answer: "",
    detected_level: "",
    suggested_display_type: block.length < 60 ? "sentence" : "paragraph"
  })) as WritingStructuredContent["parts"][number]["questions"];

  return {
    title: (parsed.data.title as string | undefined) ?? "未命名笔头作业",
    assignment_type: "writing",
    parts: [
      {
        part_title: "题目列表",
        instruction: "",
        questions
      }
    ],
    ai_summary: "AI 结构化失败，当前为系统兜底拆题结果。",
    suggested_review_points: ["可稍后重试 AI 结构化，或直接逐题批阅当前拆分结果。"]
  };
}

export function buildSpeakingFallback(markdown: string): SpeakingStructuredContent {
  const parsed = matter(markdown);
  const units = extractParagraphs(markdown).flatMap((paragraph, paragraphIndex) => {
    const lines = paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return (lines.length > 1 ? lines : [paragraph]).map((content, index) => ({
      unit_type: content.length < 18 ? "word" : content.length < 60 ? "sentence" : "paragraph",
      content,
      order_index: paragraphIndex * 10 + index + 1
    }));
  }) as SpeakingStructuredContent["units"];

  return {
    title: (parsed.data.title as string | undefined) ?? "未命名口语作业",
    assignment_type: "speaking",
    units,
    ai_summary: "AI 结构化失败，当前为系统兜底拆分结果。",
    practice_suggestions: ["建议稍后重新调用 AI，以获得更精细的朗读单元拆分。"]
  };
}
