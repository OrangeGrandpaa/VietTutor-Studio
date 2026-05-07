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

export default async function WritingAssignmentsPage() {
  await requireAuth();
  const assignments = await prisma.assignment.findMany({
    where: { type: AssignmentType.WRITING },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          sections: true
        }
      }
    }
  });

  return (
    <AppShell
      title="笔头作业"
      description="支持 Markdown、DOC、DOCX 直读，以及 PDF、PPT、Excel 等复杂文档的自动抽取。"
      actions={
        <Link href="/assignments/writing/new" className={buttonVariants()}>
          新建作业
        </Link>
      }
    >
      <PageShell>
        {assignments.length === 0 ? (
          <EmptyState
            title="还没有上传作业"
            description="从一份题目文件开始，系统会自动拆题并生成逐题作答、逐题批阅页面。"
            actionHref="/assignments/writing/new"
            actionLabel="上传第一份作业"
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
                      <span>{assignment._count.sections} 题</span>
                      <span>准确率 {formatPercent(assignment.accuracyScore)}</span>
                    </div>
                  </div>
                  <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    进入详情页可逐题输入答案、查看统计并完成批阅。
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/assignments/writing/${assignment.id}`} className={buttonVariants({ variant: "outline" })}>
                      查看
                    </Link>
                    <DeleteButton endpoint={`/api/assignments/writing/${assignment.id}`} />
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
