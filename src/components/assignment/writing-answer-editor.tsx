"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

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
const readingTypePattern =
  /reading|阅读理解|读短文|短文阅读|阅读.{0,12}(?:短文|文章)|根据.{0,12}(?:短文|文章).{0,12}(?:回答|选择|作答)/i;
const readingInstructionPattern =
  /^(?:根据|阅读|读|请阅读|回答|选择|questions?|answer|read|trả lời|đọc|câu hỏi)/i;
const questionStartPattern =
  /^(?:câu|question|q)\s*\d+[\s.、):：-]|^(?:第\s*)?\d+\s*[.、)、):：]\s*\S|^(?:问题|题目|选择题|回答问题|questions?|câu hỏi)/i;
const optionPattern = /^([A-Da-d])\s*[.、)、):：]\s*(\S.*)$/;

function normalizeQuestionPrompt(prompt: string) {
  return prompt
    .replace(/[\u2028\u2029]/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function getPromptLines(prompt: string) {
  return normalizeQuestionPrompt(prompt)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
    return [initialAnswer];
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

type ChoiceOption = {
  label: string;
  text: string;
  value: string;
};

function parseChoiceOption(line: string): ChoiceOption | null {
  const match = line.match(optionPattern);

  if (!match) {
    return null;
  }

  const label = match[1].toUpperCase();
  const text = match[2].trim();

  return {
    label,
    text,
    value: `${label}. ${text}`
  };
}

function getChoiceOptions(prompt: string) {
  return getPromptLines(prompt).flatMap((line) => {
    const option = parseChoiceOption(line);
    return option ? [option] : [];
  });
}

function isSelectedChoice(answer: string, option: ChoiceOption) {
  const normalized = answer.trim();
  return (
    normalized === option.label ||
    normalized.toUpperCase() === option.label ||
    normalized === option.value ||
    normalized === `${option.label}${option.text}` ||
    normalized === option.text
  );
}

function isReadingDisplay(displayType?: string, prompt?: string) {
  return readingTypePattern.test(displayType ?? "") || readingTypePattern.test(prompt ?? "");
}

function parseReadingPrompt(prompt: string) {
  const lines = getPromptLines(prompt);

  const questionStartIndex = lines.findIndex((line, index) => index > 0 && questionStartPattern.test(line));
  const splitIndex = questionStartIndex === -1 ? lines.length : questionStartIndex;
  const beforeQuestions = lines.slice(0, splitIndex);
  const questionLines = questionStartIndex === -1 ? [] : lines.slice(questionStartIndex);
  const instructionLines: string[] = [];
  const passageLines: string[] = [];

  beforeQuestions.forEach((line, index) => {
    if (index < 3 && readingInstructionPattern.test(line)) {
      instructionLines.push(line);
    } else {
      passageLines.push(line);
    }
  });

  return {
    instructionLines,
    passageLines: passageLines.length > 0 ? passageLines : beforeQuestions,
    questionLines
  };
}

function ChoiceOptionButton({
  option,
  selected,
  saving,
  onSelect
}: {
  option: ChoiceOption;
  selected: boolean;
  saving: boolean;
  onSelect: (option: ChoiceOption) => void;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => onSelect(option)}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/70 bg-background/70 hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      <span className="mr-2 font-semibold">{option.label}.</span>
      <span>{option.text}</span>
    </button>
  );
}

function ReadingPromptView({
  prompt,
  selectedAnswer,
  saving,
  onChoiceSelect
}: {
  prompt: string;
  selectedAnswer: string;
  saving: boolean;
  onChoiceSelect: (option: ChoiceOption) => void;
}) {
  const { instructionLines, passageLines, questionLines } = parseReadingPrompt(prompt);
  const hasQuestionLines = questionLines.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
      <section className="rounded-2xl border border-primary/15 bg-secondary/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">阅读材料</p>
          <span className="text-xs text-muted-foreground">{passageLines.length} 行</span>
        </div>
        <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1 text-base leading-8">
          {passageLines.map((line, index) => (
            <p key={`${line}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="select-none pt-0.5 text-right text-xs tabular-nums text-muted-foreground/70">
                {index + 1}
              </span>
              <span className="font-medium text-foreground">{line}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">作答要求</p>
        <div className="mt-3 space-y-3 text-sm leading-7">
          {instructionLines.length > 0 ? (
            <div className="rounded-xl bg-muted/55 p-3 text-foreground">
              {instructionLines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>
          ) : null}

          {hasQuestionLines ? (
            <div className="space-y-2">
              {questionLines.map((line, index) => {
                const option = parseChoiceOption(line);

                return option ? (
                  <ChoiceOptionButton
                    key={`${line}-${index}`}
                    option={option}
                    selected={isSelectedChoice(selectedAnswer, option)}
                    saving={saving}
                    onSelect={onChoiceSelect}
                  />
                ) : (
                  <p key={`${line}-${index}`} className="bg-transparent px-0 font-semibold text-foreground">
                    {line}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">请根据左侧阅读材料作答。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function InlinePromptView({
  promptParts,
  answers,
  setAnswers
}: {
  promptParts: PromptPart[];
  answers: string[];
  setAnswers: (answers: string[]) => void;
}) {
  return (
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
  );
}

function ChoicePromptView({
  prompt,
  selectedAnswer,
  saving,
  onChoiceSelect
}: {
  prompt: string;
  selectedAnswer: string;
  saving: boolean;
  onChoiceSelect: (option: ChoiceOption) => void;
}) {
  return (
    <div className="space-y-2 text-base leading-7">
      {getPromptLines(prompt).map((line, index) => {
        const option = parseChoiceOption(line);

        return option ? (
          <ChoiceOptionButton
            key={`${line}-${index}`}
            option={option}
            selected={isSelectedChoice(selectedAnswer, option)}
            saving={saving}
            onSelect={onChoiceSelect}
          />
        ) : (
          <p key={`${line}-${index}`} className="text-xl font-medium leading-9">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function BlankAnswerList({
  answers,
  setAnswers
}: {
  answers: string[];
  setAnswers: (answers: string[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {answers.map((value, index) => (
        <label key={index} className="space-y-1">
          <span className="text-xs text-muted-foreground">第 {index + 1} 空</span>
          <Input
            aria-label={`第 ${index + 1} 个填空答案`}
            value={value}
            onChange={(event) => {
              const nextAnswers = [...answers];
              nextAnswers[index] = event.target.value;
              setAnswers(nextAnswers);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function WritingAnswerEditor({
  assignmentId,
  sectionId,
  initialAnswer,
  prompt,
  displayType
}: {
  assignmentId: string;
  sectionId: string;
  initialAnswer: string;
  prompt: string;
  displayType?: string;
}) {
  const router = useRouter();
  const promptParts = splitPrompt(prompt);
  const blankCount = promptParts.filter((part) => part.type === "blank").length;
  const [answers, setAnswers] = useState(() => parseInitialAnswers(initialAnswer, blankCount));
  const [saving, setSaving] = useState(false);
  const answer = serializeAnswers(answers);
  const isDirty = answer !== initialAnswer;
  const isReading = isReadingDisplay(displayType, prompt);
  const choiceOptions = getChoiceOptions(prompt);
  const isChoiceQuestion = blankCount === 0 && choiceOptions.length >= 2;

  async function saveAnswer(nextAnswer = answer) {
    setSaving(true);

    try {
      const response = await fetch(`/api/assignments/writing/${assignmentId}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          answer: nextAnswer
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

  async function selectChoice(option: ChoiceOption) {
    const nextAnswer = option.value;
    setAnswers([nextAnswer]);
    await saveAnswer(nextAnswer);
  }

  const saveButton = (
    <Button type="button" variant="outline" disabled={saving || !isDirty} onClick={() => saveAnswer()}>
      {saving ? "保存中..." : isDirty ? "保存答案" : "答案已保存"}
    </Button>
  );

  return (
    <div className="mt-2 space-y-4">
      {isReading ? (
        <ReadingPromptView
          prompt={prompt}
          selectedAnswer={answers[0] ?? ""}
          saving={saving}
          onChoiceSelect={selectChoice}
        />
      ) : isChoiceQuestion ? (
        <ChoicePromptView
          prompt={prompt}
          selectedAnswer={answers[0] ?? ""}
          saving={saving}
          onChoiceSelect={selectChoice}
        />
      ) : (
        <InlinePromptView promptParts={promptParts} answers={answers} setAnswers={setAnswers} />
      )}

      {isChoiceQuestion ? null : blankCount === 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">学生答案</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <AutoResizeTextarea
              aria-label="学生答案"
              className="text-base leading-7 sm:flex-1"
              placeholder="在这里输入答案"
              value={answers[0] ?? ""}
              onChange={(event) => setAnswers([event.target.value])}
            />
            <div className="shrink-0">{saveButton}</div>
          </div>
        </div>
      ) : isReading ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">填空答案</p>
          <BlankAnswerList answers={answers} setAnswers={setAnswers} />
          {saveButton}
        </div>
      ) : (
        saveButton
      )}
    </div>
  );
}
