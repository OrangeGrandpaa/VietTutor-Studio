"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PromptPart =
  | {
      type: "text";
      value: string;
    }
  | {
      length: number;
      type: "blank";
    };

const blankPattern = /_{3,}/g;

function normalizeQuestionPrompt(prompt: string) {
  return prompt
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function splitPrompt(prompt: string): PromptPart[] {
  const normalized = normalizeQuestionPrompt(prompt);
  const parts: PromptPart[] = [];
  let lastIndex = 0;

  for (const match of normalized.matchAll(blankPattern)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({
        type: "text",
        value: normalized.slice(lastIndex, index)
      });
    }

    parts.push({
      type: "blank",
      length: match[0].length
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    parts.push({
      type: "text",
      value: normalized.slice(lastIndex)
    });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: normalized }];
}

function parseInitialAnswers(initialAnswer: string, blankCount: number) {
  if (blankCount === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(initialAnswer) as unknown;

    if (Array.isArray(parsed)) {
      return Array.from({ length: blankCount }, (_, index) =>
        typeof parsed[index] === "string" ? parsed[index] : ""
      );
    }
  } catch {}

  return Array.from({ length: blankCount }, (_, index) => (index === 0 ? initialAnswer : ""));
}

function serializeAnswers(answers: string[]) {
  if (answers.length === 0) {
    return "";
  }

  if (answers.length === 1) {
    return answers[0];
  }

  return JSON.stringify(answers);
}

export function WritingAnswerEditor({
  assignmentId,
  sectionId,
  initialAnswer,
  prompt
}: {
  assignmentId: string;
  sectionId: string;
  initialAnswer: string;
  prompt: string;
}) {
  const router = useRouter();
  const promptParts = splitPrompt(prompt);
  const blankCount = promptParts.filter((part) => part.type === "blank").length;
  const [answers, setAnswers] = useState(() => parseInitialAnswers(initialAnswer, blankCount));
  const [saving, setSaving] = useState(false);
  const answer = serializeAnswers(answers);
  const isDirty = answer !== initialAnswer;

  async function saveAnswer() {
    setSaving(true);

    try {
      const response = await fetch(`/api/assignments/writing/${assignmentId}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          answer
        })
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message ?? "保存学生答案失败。");
      }

      toast.success(result?.message ?? "学生答案已保存。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存学生答案失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-4">
      <div className="whitespace-pre-wrap text-xl font-medium leading-10">
        {promptParts.map((part, index) => {
          if (part.type === "text") {
            return <span key={`text-${index}`}>{part.value}</span>;
          }

          const blankIndex = promptParts.slice(0, index).filter((item) => item.type === "blank").length;
          const value = answers[blankIndex] ?? "";

          return (
            <Input
              key={`blank-${index}`}
              aria-label={`第 ${blankIndex + 1} 个填空`}
              className="mx-1 inline-flex h-9 min-w-0 rounded-lg px-2 py-1 align-baseline text-lg font-semibold"
              style={{ width: `${Math.max(part.length, value.length, 2) + 1}ch` }}
              value={value}
              onChange={(event) => {
                const nextAnswers = [...answers];
                nextAnswers[blankIndex] = event.target.value;
                setAnswers(nextAnswers);
              }}
            />
          );
        })}
      </div>

      {blankCount > 0 ? (
        <Button type="button" variant="outline" disabled={saving || !isDirty} onClick={saveAnswer}>
          {saving ? "保存中..." : isDirty ? "保存答案" : "答案已保存"}
        </Button>
      ) : null}
    </div>
  );
}
