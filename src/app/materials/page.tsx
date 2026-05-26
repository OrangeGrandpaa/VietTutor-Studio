import Link from "next/link";
import type { Route } from "next";

import { MaterialFileType } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  formatDateTime,
  materialCategoryLabel,
  materialFileTypeLabel
} from "@/lib/utils/format";
import { getPagination } from "@/lib/utils/pagination";

const TEXT = {
  pageTitle: "\u8bfe\u4ef6\u5e93",
  pageDescription:
    "\u7edf\u4e00\u7ba1\u7406 PDF\u3001Word\u3001PowerPoint\u3001Markdown\u3001\u56fe\u7247\u3001\u97f3\u9891\u548c\u89c6\u9891\u8bfe\u4ef6\u3002",
  uploadMaterial: "\u4e0a\u4f20\u8bfe\u4ef6",
  all: "\u5168\u90e8",
  image: "\u56fe\u7247",
  audio: "\u97f3\u9891",
  video: "\u89c6\u9891",
  other: "\u5176\u4ed6",
  emptyTitle: "\u8fd8\u6ca1\u6709\u8bfe\u4ef6",
  emptyDescription:
    "\u4e0a\u4f20 PDF\u3001Markdown \u6216\u97f3\u89c6\u9891\u8bfe\u4ef6\uff0c\u8ba9\u6750\u6599\u7edf\u4e00\u7ba1\u7406\u548c\u9884\u89c8\u3002",
  firstUpload: "\u4e0a\u4f20\u7b2c\u4e00\u4efd\u8bfe\u4ef6",
  uploadedAt: "\u4e0a\u4f20\u65f6\u95f4\uff1a",
  view: "\u67e5\u770b"
} as const;

function buildMaterialsHref(type: string | undefined, page = 1) {
  const params = new URLSearchParams();

  if (type) {
    params.set("type", type);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return (query ? `/materials?${query}` : "/materials") as Route;
}

export default async function MaterialsPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string; page?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;
  const type = params?.type;
  const fileTypeFilter = type && type in MaterialFileType ? (type as keyof typeof MaterialFileType) : null;
  const where = fileTypeFilter ? { fileType: MaterialFileType[fileTypeFilter] } : undefined;
  const totalItems = await prisma.courseMaterial.count({ where });
  const pagination = getPagination({ page: params?.page, totalItems });

  const materials = await prisma.courseMaterial.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      title: true,
      fileType: true,
      category: true,
      createdAt: true
    }
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
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDateTime(material.createdAt)}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {TEXT.uploadedAt}
                      {formatDateTime(material.createdAt)}
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
            <PaginationControls
              buildHref={(page) => buildMaterialsHref(fileTypeFilter ?? undefined, page)}
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
