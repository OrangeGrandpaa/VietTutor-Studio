import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { RetryAiButton } from "@/components/assignment/retry-ai-button";
import { WritingAnswerEditor } from "@/components/assignment/writing-answer-editor";
import { WritingQuestionReviewControls } from "@/components/assignment/writing-question-review-controls";
import { WritingReviewPanel } from "@/components/assignment/writing-review-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildWritingReviewGroups } from "@/lib/assignment/writing";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

export default async function WritingAssignmentDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        include: { feedbacks: { orderBy: { updatedAt: "desc" } } }
      }
    }
  });

  if (!assignment) {
    notFound();
  }

  const { groups, stats } = buildWritingReviewGroups(assignment.sections, assignment.aiStructuredContent);

  return (
    <AppShell
      title={assignment.title}
      description={`上传于 ${formatDateTime(assignment.createdAt)}，已拆成 ${stats.totalQuestions} 道题供逐题作答和批阅。`}
      actions={
        <>
          {assignment.aiStatus === "FAILED" ? (
            <RetryAiButton
              endpoint={`/api/assignments/writing/${assignment.id}`}
              method="PATCH"
              body={{ action: "retry-ai" }}
            />
          ) : null}
          <Link
            href={`/api/files/${assignment.id}?kind=assignment&download=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            下载原始文件
          </Link>
        </>
      }
    >
      <PageShell>
        <div className="flex flex-wrap items-center gap-3">
          <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
          <Badge variant="outline">总题数 {stats.totalQuestions}</Badge>
          <Badge variant="outline">已批阅 {stats.reviewedQuestions}</Badge>
          <Badge variant="outline">整体准确率 {formatPercent(stats.accuracy)}</Badge>
        </div>

        {assignment.aiStatus === "FAILED" && assignment.aiErrorMessage ? (
          <Card className="border-amber-300/70 bg-amber-50/70">
            <CardHeader>
              <CardTitle>AI 结构化失败原因</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-foreground/80">{assignment.aiErrorMessage}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>原始上传文件</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{assignment.originalFileName}</p>
                  <p>系统会从上传文件中抽取题目并按题展示，原文件请通过下载链接查看。</p>
                </div>
                <Link
                  href={`/api/files/${assignment.id}?kind=assignment&download=1`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  下载原始文件
                </Link>
              </CardContent>
            </Card>

            {groups.map((group) => (
              <Card key={`${group.partIndex}-${group.partTitle}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>{group.partTitle}</CardTitle>
                      {group.instruction ? (
                        <p className="mt-2 text-sm text-muted-foreground">{group.instruction}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{group.totalQuestions} 题</Badge>
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
                          {question.isCorrect === true
                            ? "正确"
                            : question.isCorrect === false
                              ? "错误"
                              : "待批阅"}
                        </Badge>
                        {question.detectedLevel ? <Badge variant="outline">{question.detectedLevel}</Badge> : null}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">题目内容</p>
                          <p className="mt-2 whitespace-pre-wrap text-xl font-medium leading-8">{question.prompt}</p>
                        </div>

                        <div className="rounded-xl bg-secondary/40 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">学生答案</p>
                          <WritingAnswerEditor
                            assignmentId={assignment.id}
                            sectionId={question.id}
                            initialAnswer={question.answer ?? ""}
                          />
                        </div>

                        <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">题目批阅</p>
                          <WritingQuestionReviewControls
                            assignmentId={assignment.id}
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

          <WritingReviewPanel groups={groups} stats={stats} />
        </div>
      </PageShell>
    </AppShell>
  );
}
