import type { AiProcessStatus, AssignmentSection, TeacherFeedback } from "@prisma/client";

import { repairTextMojibake } from "@/lib/assignment/text-encoding";
import type { WritingPart, WritingStructuredContent } from "@/types/assignment";

type SectionWithFeedbacks = AssignmentSection & {
  feedbacks: TeacherFeedback[];
};

export type WritingQuestionReviewItem = {
  id: string;
  orderIndex: number;
  questionNumber: number;
  partTitle: string;
  partIndex: number;
  sectionTitle: string;
  prompt: string;
  answer: string | null;
  displayType: string;
  detectedLevel: string | null;
  feedbackId: string | null;
  isCorrect: boolean | null;
  note: string;
};

export type WritingPartReviewGroup = {
  partTitle: string;
  partIndex: number;
  instruction: string;
  totalQuestions: number;
  reviewedQuestions: number;
  correctQuestions: number;
  accuracy: number | null;
  exerciseGroups: WritingExerciseReviewGroup[];
  questions: WritingQuestionReviewItem[];
};

export type WritingExerciseReviewGroup = {
  key: string;
  title: string;
  partIndex: number;
  firstQuestionId: string;
  totalQuestions: number;
  reviewedQuestions: number;
  correctQuestions: number;
  accuracy: number | null;
};

export type WritingReviewStats = {
  totalQuestions: number;
  reviewedQuestions: number;
  correctQuestions: number;
  accuracy: number | null;
  pendingQuestions: number;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? repairTextMojibake(value).trim() : "";
}

function normalizeQuestionText(value: unknown) {
  return normalizeText(value)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function normalizeDisplayType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || "paragraph";
}

function toAccuracy(correct: number, reviewed: number) {
  if (!reviewed) return null;
  return Math.round((correct / reviewed) * 100);
}

const exerciseTitlePattern =
  /^(?:练习|習題|习题|exercise|bài\s*tập)\s*[\d一二三四五六七八九十]+[\s:：、.\-]+.+/i;

function normalizeExerciseTitle(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExerciseTitle(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const lines = normalizeText(value)
      .split("\n")
      .map(normalizeExerciseTitle)
      .filter(Boolean);

    const match = lines.find((line) => exerciseTitlePattern.test(line));

    if (match) {
      return match;
    }
  }

  return null;
}

function buildExerciseGroups(
  part: WritingPart,
  partIndex: number,
  questions: WritingQuestionReviewItem[]
): WritingExerciseReviewGroup[] {
  const groups = new Map<string, WritingQuestionReviewItem[]>();
  const explicitPartTitle = extractExerciseTitle(part.part_title, part.instruction);
  let currentTitle = explicitPartTitle;

  for (const question of questions) {
    currentTitle =
      extractExerciseTitle(question.sectionTitle, question.prompt) ?? currentTitle;

    if (!currentTitle) {
      continue;
    }

    const bucket = groups.get(currentTitle) ?? [];
    bucket.push(question);
    groups.set(currentTitle, bucket);
  }

  return [...groups.entries()].map(([title, items], index) => {
    const reviewedQuestions = items.filter((item) => item.isCorrect !== null).length;
    const correctQuestions = items.filter((item) => item.isCorrect === true).length;

    return {
      key: `${partIndex}-${index}-${title}`,
      title,
      partIndex,
      firstQuestionId: items[0].id,
      totalQuestions: items.length,
      reviewedQuestions,
      correctQuestions,
      accuracy: toAccuracy(correctQuestions, reviewedQuestions)
    };
  });
}

export function normalizeWritingStructure(value: unknown): WritingStructuredContent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as {
    title?: unknown;
    assignment_type?: unknown;
    parts?: unknown;
  };

  const parts = Array.isArray(raw.parts)
    ? raw.parts
        .map((part, partIndex) => {
          if (!part || typeof part !== "object") return null;
          const rawPart = part as {
            part_title?: unknown;
            instruction?: unknown;
            questions?: unknown;
          };

          const questions = Array.isArray(rawPart.questions)
            ? rawPart.questions
                .map((question, questionIndex) => {
                  if (!question || typeof question !== "object") return null;
                  const rawQuestion = question as {
                    question_number?: unknown;
                    prompt?: unknown;
                    answer?: unknown;
                    detected_level?: unknown;
                    suggested_display_type?: unknown;
                  };

                  return {
                    question_number:
                      typeof rawQuestion.question_number === "number"
                        ? rawQuestion.question_number
                        : questionIndex + 1,
                    prompt: normalizeQuestionText(rawQuestion.prompt),
                    answer: normalizeText(rawQuestion.answer),
                    detected_level: normalizeText(rawQuestion.detected_level),
                    suggested_display_type:
                      normalizeDisplayType(
                        rawQuestion.suggested_display_type
                      ) as WritingPart["questions"][number]["suggested_display_type"]
                  };
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item))
            : [];

          return {
            part_title: normalizeText(rawPart.part_title) || `第 ${partIndex + 1} 部分`,
            instruction: normalizeText(rawPart.instruction),
            questions
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    title: normalizeText(raw.title) || "未命名笔头作业",
    assignment_type: raw.assignment_type === "writing" ? "writing" : "writing",
    parts
  };
}

export function flattenWritingQuestions(structured: WritingStructuredContent) {
  return structured.parts.flatMap((part, partIndex) =>
    part.questions.map((question, questionIndex) => ({
      partTitle: part.part_title || `第 ${partIndex + 1} 部分`,
      partIndex,
      instruction: part.instruction,
      questionNumber: question.question_number || questionIndex + 1,
      prompt: question.prompt,
      answer: question.answer || null,
      detectedLevel: question.detected_level || null,
      displayType: question.suggested_display_type
    }))
  );
}

export function buildFallbackWritingStructure(sections: SectionWithFeedbacks[]) {
  const questions = sections.map((section, index) => ({
    question_number: index + 1,
    prompt: normalizeQuestionText(section.originalText),
    answer: section.vietnameseText ?? "",
    detected_level: section.detectedLevel ?? "",
    suggested_display_type: "paragraph" as const
  }));

  return {
    title: "未命名笔头作业",
    assignment_type: "writing" as const,
    parts: [
      {
        part_title: "题目列表",
        instruction: "",
        questions
      }
    ]
  };
}

function extractLatestFeedback(feedbacks: TeacherFeedback[]) {
  if (!feedbacks.length) {
    return null;
  }

  return [...feedbacks].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0] ?? null;
}

export function buildWritingReviewGroups(
  sections: SectionWithFeedbacks[],
  aiStructuredContent: unknown
): {
  groups: WritingPartReviewGroup[];
  stats: WritingReviewStats;
} {
  const structured = normalizeWritingStructure(aiStructuredContent) ?? buildFallbackWritingStructure(sections);
  const flattened = flattenWritingQuestions(structured);

  const questionItems = sections.map((section, index) => {
    const question = flattened[index];
    const feedback = extractLatestFeedback(section.feedbacks);
    const score = feedback?.score ?? null;

    return {
      id: section.id,
      orderIndex: section.orderIndex,
      questionNumber: question?.questionNumber ?? index + 1,
      partTitle: question?.partTitle ?? "题目列表",
      partIndex: question?.partIndex ?? 0,
      sectionTitle: section.sectionTitle,
      prompt: question?.prompt || section.originalText,
      answer: section.vietnameseText ?? question?.answer ?? null,
      displayType: question?.displayType ?? "paragraph",
      detectedLevel: question?.detectedLevel ?? section.detectedLevel ?? null,
      feedbackId: feedback?.id ?? null,
      isCorrect: score === null ? null : score >= 100,
      note: feedback?.explanation ?? ""
    } satisfies WritingQuestionReviewItem;
  });

  const groups = structured.parts.map((part, partIndex) => {
    const questions = questionItems.filter((item) => item.partIndex === partIndex);
    const reviewedQuestions = questions.filter((item) => item.isCorrect !== null).length;
    const correctQuestions = questions.filter((item) => item.isCorrect === true).length;

    return {
      partTitle: part.part_title || `第 ${partIndex + 1} 部分`,
      partIndex,
      instruction: part.instruction,
      totalQuestions: questions.length,
      reviewedQuestions,
      correctQuestions,
      accuracy: toAccuracy(correctQuestions, reviewedQuestions),
      exerciseGroups: buildExerciseGroups(part, partIndex, questions),
      questions
    } satisfies WritingPartReviewGroup;
  });

  if (!groups.length) {
    const reviewedQuestions = questionItems.filter((item) => item.isCorrect !== null).length;
    const correctQuestions = questionItems.filter((item) => item.isCorrect === true).length;

    groups.push({
      partTitle: "题目列表",
      partIndex: 0,
      instruction: "",
      totalQuestions: questionItems.length,
      reviewedQuestions,
      correctQuestions,
      accuracy: toAccuracy(correctQuestions, reviewedQuestions),
      exerciseGroups: [],
      questions: questionItems
    });
  }

  const reviewedQuestions = questionItems.filter((item) => item.isCorrect !== null).length;
  const correctQuestions = questionItems.filter((item) => item.isCorrect === true).length;

  return {
    groups,
    stats: {
      totalQuestions: questionItems.length,
      reviewedQuestions,
      correctQuestions,
      accuracy: toAccuracy(correctQuestions, reviewedQuestions),
      pendingQuestions: Math.max(0, questionItems.length - reviewedQuestions)
    }
  };
}

export function getWritingAssignmentStatus(totalQuestions: number, reviewedQuestions: number): {
  status: "PENDING_REVIEW" | "REVIEWING" | "REVIEWED";
  aiStatus?: AiProcessStatus;
} {
  if (!reviewedQuestions) {
    return { status: "PENDING_REVIEW" };
  }

  if (reviewedQuestions >= totalQuestions && totalQuestions > 0) {
    return { status: "REVIEWED" };
  }

  return { status: "REVIEWING" };
}
