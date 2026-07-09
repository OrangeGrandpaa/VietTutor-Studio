"use client";

import { WritingAnswerEditor } from "@/components/assignment/writing-answer-editor";
import { WritingQuestionReviewControls } from "@/components/assignment/writing-question-review-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  progressStatusLabel,
  type ItemProgressStatus
} from "@/lib/assignment/progress-status";
import type { WritingPartReviewGroup } from "@/lib/assignment/writing";
import { cn } from "@/lib/utils/cn";
import { formatPercent } from "@/lib/utils/format";

export function getWritingPartAnchor(partIndex: number) {
  return `writing-part-${partIndex}`;
}

export function getWritingQuestionAnchor(questionId: string) {
  return `writing-question-${questionId}`;
}

function isReadingQuestion(displayType: string, partTitle: string, instruction: string, prompt: string) {
  return /reading|阅读理解|读短文|短文阅读|阅读.{0,12}(?:短文|文章)|根据.{0,12}(?:短文|文章).{0,12}(?:回答|选择|作答)/i.test(
    `${displayType} ${partTitle} ${instruction} ${prompt}`
  );
}

function itemProgressVariant(status: ItemProgressStatus) {
  switch (status) {
    case "REVIEWED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    case "NOT_STARTED":
      return "destructive";
    case "UNREVIEWED":
    default:
      return "outline";
  }
}

export function WritingQuestionGroups({
  assignmentId,
  groups,
  wrongOnly = false
}: {
  assignmentId: string;
  groups: WritingPartReviewGroup[];
  wrongOnly?: boolean;
}) {
  const visibleGroups = wrongOnly
    ? groups
        .map((group) => ({
          ...group,
          questions: group.questions.filter((question) => question.isCorrect === false)
        }))
        .filter((group) => group.questions.length > 0)
    : groups;

  return (
    <div className="space-y-6">
      {wrongOnly && visibleGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">当前没有已标记为错误的题目。</CardContent>
        </Card>
      ) : null}

      {visibleGroups.map((group) => (
        <Card
          id={getWritingPartAnchor(group.partIndex)}
          key={`${group.partIndex}-${group.partTitle}`}
          className="scroll-mt-24"
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{group.partTitle}</CardTitle>
                {group.instruction ? (
                  <p className="mt-2 text-sm text-muted-foreground">{group.instruction}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{group.questions.length} 题</Badge>
                <Badge variant="outline">已作答 {group.completedQuestions}</Badge>
                <Badge variant="outline">准确率 {formatPercent(group.accuracy)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.questions.map((question) => {
              const isReading = isReadingQuestion(
                question.displayType,
                group.partTitle,
                group.instruction,
                question.prompt
              );

              return (
                <div
                  id={getWritingQuestionAnchor(question.id)}
                  key={question.id}
                  className={cn(
                    "scroll-mt-24 rounded-[1.5rem] border border-border/70 p-5",
                    isReading ? "border-primary/20 bg-secondary/20" : ""
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">第 {question.questionNumber} 题</Badge>
                    {isReading ? <Badge variant="outline">阅读理解</Badge> : null}
                    <Badge variant={itemProgressVariant(question.progressStatus)}>
                      {progressStatusLabel(question.progressStatus)}
                    </Badge>
                    {question.isCorrect !== null ? (
                      <Badge variant={question.isCorrect ? "success" : "destructive"}>
                        {question.isCorrect ? "正确" : "错误"}
                      </Badge>
                    ) : null}
                    {question.detectedLevel ? <Badge variant="outline">{question.detectedLevel}</Badge> : null}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">题目内容</p>
                      <WritingAnswerEditor
                        assignmentId={assignmentId}
                        sectionId={question.id}
                        initialAnswer={question.answer ?? ""}
                        prompt={question.prompt}
                        displayType={isReading ? "reading" : question.displayType}
                      />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">题目批阅</p>
                      <WritingQuestionReviewControls
                        assignmentId={assignmentId}
                        sectionId={question.id}
                        isCorrect={question.isCorrect}
                        initialNote={question.note}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
