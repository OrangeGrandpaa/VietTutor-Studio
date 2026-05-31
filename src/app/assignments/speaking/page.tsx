import Link from "next/link";
import type { Route } from "next";

import { AssignmentType } from "@prisma/client";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatScore } from "@/lib/utils/format";
import { getPagination } from "@/lib/utils/pagination";

function buildSpeakingHref(page = 1) {
  return (page > 1 ? `/assignments/speaking?page=${page}` : "/assignments/speaking") as Route;
}

export default async function SpeakingAssignmentsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;
  const where = { type: AssignmentType.SPEAKING };
  const totalItems = await prisma.assignment.count({ where });
  const pagination = getPagination({ page: params?.page, totalItems });
  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      title: true,
      status: true,
      aiStatus: true,
      createdAt: true,
      originalFileName: true,
      overallScore: true,
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
      description="上传 TXT 纯文本后按句拆分，学生逐句录音，教师可录制标准音并给出三档判断。"
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
            description="上传一份 TXT 朗读文本，系统会自动拆成适合逐句录音和批阅的句子。"
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
                      <span>{assignment._count.speakingUnits} 句</span>
                      <span>综合分 {formatScore(assignment.overallScore)}</span>
                    </div>
                  </div>
                  <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    进入详情页可查看朗读文本、学生录音、教师标准音和逐句判断结果。
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
            <PaginationControls
              buildHref={buildSpeakingHref}
              page={pagination.page}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
            />
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
