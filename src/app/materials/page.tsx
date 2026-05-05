import Link from "next/link";

import { MaterialFileType } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  formatDateTime,
  materialCategoryLabel,
  materialFileTypeLabel,
  progressStatusLabel
} from "@/lib/utils/format";

const TEXT = {
  pageTitle: "\u8bfe\u4ef6\u5e93",
  pageDescription:
    "\u7edf\u4e00\u7ba1\u7406 PDF\u3001Word\u3001PowerPoint\u3001Markdown\u3001\u56fe\u7247\u3001\u97f3\u9891\u548c\u89c6\u9891\uff0c\u5e76\u8bb0\u5f55\u5b66\u4e60\u8fdb\u5ea6\u3002",
  uploadMaterial: "\u4e0a\u4f20\u8bfe\u4ef6",
  all: "\u5168\u90e8",
  image: "\u56fe\u7247",
  audio: "\u97f3\u9891",
  video: "\u89c6\u9891",
  other: "\u5176\u4ed6",
  emptyTitle: "\u8fd8\u6ca1\u6709\u8bfe\u4ef6",
  emptyDescription:
    "\u4e0a\u4f20 PDF\u3001Markdown \u6216\u97f3\u89c6\u9891\u8bfe\u4ef6\uff0c\u5e76\u8bb0\u5f55\u4f60\u7684\u5b66\u4e60\u4f4d\u7f6e\u3002",
  firstUpload: "\u4e0a\u4f20\u7b2c\u4e00\u4efd\u8bfe\u4ef6",
  learningProgress: "\u5b66\u4e60\u8fdb\u5ea6",
  recentPosition: "\u6700\u8fd1\u4f4d\u7f6e\uff1a",
  learnedPage: "\u7b2c {page} \u9875",
  notRecorded: "\u672a\u8bb0\u5f55",
  note: "\u5907\u6ce8\uff1a",
  noNote: "\u6682\u65e0\u5907\u6ce8",
  view: "\u67e5\u770b"
} as const;

function formatRecentPosition(currentPage: number | null) {
  if (!currentPage) {
    return TEXT.notRecorded;
  }

  return TEXT.learnedPage.replace("{page}", String(currentPage));
}

export default async function MaterialsPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  await requireAuth();
  const type = (await searchParams)?.type;
  const fileTypeFilter = type && type in MaterialFileType ? (type as keyof typeof MaterialFileType) : null;

  const materials = await prisma.courseMaterial.findMany({
    where: fileTypeFilter ? { fileType: MaterialFileType[fileTypeFilter] } : undefined,
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppShell
      title={TEXT.pageTitle}
      description={TEXT.pageDescription}
      actions={
        <Link href="/materials/new" className={buttonVariants()}>
          {TEXT.uploadMaterial}
        </Link>
      }
    >
      <PageShell>
        <div className="flex flex-wrap gap-2">
          {[
            [TEXT.all, ""],
            ["PDF", "PDF"],
            ["Word", "WORD"],
            ["PPT", "POWERPOINT"],
            ["Markdown", "MARKDOWN"],
            [TEXT.image, "IMAGE"],
            [TEXT.audio, "AUDIO"],
            [TEXT.video, "VIDEO"],
            [TEXT.other, "OTHER"]
          ].map(([label, value]) => (
            <Link
              key={label}
              href={value ? `/materials?type=${value}` : "/materials"}
              className={buttonVariants({ variant: type === value ? "default" : "outline", size: "sm" })}
            >
              {label}
            </Link>
          ))}
        </div>

        {materials.length === 0 ? (
          <EmptyState
            title={TEXT.emptyTitle}
            description={TEXT.emptyDescription}
            actionHref="/materials/new"
            actionLabel={TEXT.firstUpload}
          />
        ) : (
          <div className="grid gap-4">
            {materials.map((material) => (
              <Card key={material.id}>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <CardTitle>{material.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{materialFileTypeLabel(material.fileType)}</Badge>
                      <Badge variant="outline">{materialCategoryLabel(material.category)}</Badge>
                      <Badge variant="outline">{progressStatusLabel(material.progressStatus)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDateTime(material.createdAt)}</p>
                  </div>
                  <div className="min-w-44 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{TEXT.learningProgress}</span>
                      <span>{material.progressPercent}%</span>
                    </div>
                    <Progress value={material.progressPercent} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {TEXT.recentPosition}
                      {formatRecentPosition(material.currentPage)}
                    </p>
                    <p>
                      {TEXT.note}
                      {material.note ?? TEXT.noNote}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/materials/${material.id}`} className={buttonVariants({ variant: "outline" })}>
                      {TEXT.view}
                    </Link>
                    <DeleteButton endpoint={`/api/materials/${material.id}`} />
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
