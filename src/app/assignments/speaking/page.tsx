import Link from "next/link";

import { AssignmentType } from "@prisma/client";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

export default async function SpeakingAssignmentsPage() {
  await requireAuth();
  const assignments = await prisma.assignment.findMany({
    where: { type: AssignmentType.SPEAKING },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          speakingUnits: true
        }
      }
    }
  });

  return (
    <AppShell
      title="口语作业"
      description="支持 Markdown、DOC、DOCX 直读，以及 PDF、PPT、Excel 等复杂文档的自动抽取。"
      actions={
        <Link href="/assignments/speaking/new" className={buttonVariants()}>
          新建口语作业
        </Link>
      }
    >
      <PageShell>
        {assignments.length === 0 ? (
          <EmptyState
            title="还没有口语作业"
            description="上传一份练习文件，系统会自动拆成适合逐条录音和批阅的练习单元。"
            actionHref="/assignments/speaking/new"
            actionLabel="上传第一份口语作业"
          />
        ) : (
          <div className="grid gap-4">
            {assignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <CardTitle>{assignment.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatDateTime(assignment.createdAt)}</span>
                      <span>{assignment.originalFileName}</span>
                      <span>{assignment._count.speakingUnits} 个单元</span>
                      <span>综合分 {formatPercent(assignment.overallScore)}</span>
                    </div>
                  </div>
                  <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    进入详情页可查看练习单元、录音情况和逐条批阅结果。
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/assignments/speaking/${assignment.id}`} className={buttonVariants({ variant: "outline" })}>
                      查看
                    </Link>
                    <DeleteButton endpoint={`/api/assignments/speaking/${assignment.id}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
