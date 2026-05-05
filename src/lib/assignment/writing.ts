import type { AiProcessStatus, AssignmentSection, TeacherFeedback } from "@prisma/client";

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
  questions: WritingQuestionReviewItem[];
};

export type WritingReviewStats = {
  totalQuestions: number;
  reviewedQuestions: number;
  correctQuestions: number;
  accuracy: number | null;
  pendingQuestions: number;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDisplayType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || "paragraph";
}

function toAccuracy(correct: number, reviewed: number) {
  if (!reviewed) return null;
  return Math.round((correct / reviewed) * 100);
}

export function normalizeWritingStructure(value: unknown): WritingStructuredContent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as {
    title?: unknown;
    assignment_type?: unknown;
    parts?: unknown;
    ai_summary?: unknown;
    suggested_review_points?: unknown;
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
                    prompt: normalizeText(rawQuestion.prompt),
                    answer: normalizeText(rawQuestion.answer),
                    detected_level: normalizeText(rawQuestion.detected_level),
                    suggested_display_type: normalizeDisplayType(rawQuestion.suggested_display_type) as WritingPart["questions"][number]["suggested_display_type"]
                  };
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item))
            : [];

          return {
            part_title: normalizeText(rawPart.part_title) || `部分 ${partIndex + 1}`,
            instruction: normalizeText(rawPart.instruction),
            questions
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    title: normalizeText(raw.title) || "未命名笔头作业",
    assignment_type: raw.assignment_type === "writing" ? "writing" : "writing",
    parts,
    ai_summary: normalizeText(raw.ai_summary),
    suggested_review_points: Array.isArray(raw.suggested_review_points)
      ? raw.suggested_review_points.map((item) => normalizeText(item)).filter(Boolean)
      : []
  };
}

export function flattenWritingQuestions(structured: WritingStructuredContent) {
  return structured.parts.flatMap((part, partIndex) =>
    part.questions.map((question, questionIndex) => ({
      partTitle: part.part_title || `部分 ${partIndex + 1}`,
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
    prompt: section.originalText,
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
    ],
    ai_summary: "",
    suggested_review_points: []
  };
}

function extractLatestFeedback(feedbacks: TeacherFeedback[]) {
  const correctionFeedbacks = feedbacks.filter((item) => item.feedbackType === "CORRECTION");

  if (!correctionFeedbacks.length) {
    return null;
  }

  return [...correctionFeedbacks].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0] ?? null;
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
      answer: question?.answer || (section.vietnameseText ?? null),
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
      partTitle: part.part_title || `部分 ${partIndex + 1}`,
      partIndex,
      instruction: part.instruction,
      totalQuestions: questions.length,
      reviewedQuestions,
      correctQuestions,
      accuracy: toAccuracy(correctQuestions, reviewedQuestions),
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
