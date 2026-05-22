"use client";

import { WritingAnswerEditor } from "@/components/assignment/writing-answer-editor";
import { WritingQuestionReviewControls } from "@/components/assignment/writing-question-review-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WritingPartReviewGroup } from "@/lib/assignment/writing";
import { formatPercent } from "@/lib/utils/format";

export function getWritingPartAnchor(partIndex: number) {
  return `writing-part-${partIndex}`;
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
                <Badge variant="outline">准确率 {formatPercent(group.accuracy)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.questions.map((question) => (
              <div key={question.id} className="rounded-[1.5rem] border border-border/70 p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">第 {question.questionNumber} 题</Badge>
                  <Badge
                    variant={
                      question.isCorrect === true
                        ? "success"
                        : question.isCorrect === false
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {question.isCorrect === true ? "正确" : question.isCorrect === false ? "错误" : "待批阅"}
                  </Badge>
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
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
