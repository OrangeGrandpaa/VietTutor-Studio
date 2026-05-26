import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  formatDateTime,
  materialCategoryLabel,
  materialFileTypeLabel
} from "@/lib/utils/format";

const TEXT = {
  previewTitle: "\u8bfe\u4ef6\u9884\u89c8",
  unsupportedPreview:
    "\u5f53\u524d\u6587\u4ef6\u7c7b\u578b\u4e0d\u652f\u6301\u5185\u5d4c\u9884\u89c8\uff0c\u53ef\u4f7f\u7528\u53f3\u4e0a\u89d2\u6309\u94ae\u4e0b\u8f7d\u3002",
  previewAlt: "\u8bfe\u4ef6\u9884\u89c8",
  uploadedAt: "\u4e0a\u4f20\u4e8e {time}\uff0c\u6587\u4ef6\u540d\uff1a{fileName}",
  downloadFile: "\u4e0b\u8f7d\u6587\u4ef6"
} as const;

function renderPreview(id: string, mimeType: string | null) {
  const src = `/api/files/${id}?kind=material`;

  if (!mimeType) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
        {TEXT.unsupportedPreview}
      </div>
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <div className="relative flex h-full items-center justify-center rounded-2xl border border-border/70 bg-muted/10 p-4">
        <Image
          src={src}
          alt={TEXT.previewAlt}
          fill
          priority
          unoptimized
          sizes="100vw"
          className="rounded-xl object-contain p-4"
        />
      </div>
    );
  }

  if (mimeType.startsWith("audio/")) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border/70 bg-muted/10 p-6">
        <audio controls preload="metadata" className="w-full" src={src} />
      </div>
    );
  }

  if (mimeType.startsWith("video/")) {
    return <video controls preload="metadata" className="h-full w-full rounded-2xl object-contain" src={src} />;
  }

  if (mimeType.includes("pdf")) {
    return (
      <iframe
        title={TEXT.previewAlt}
        src={src}
        className="h-full w-full rounded-2xl border border-border/70"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
      {TEXT.unsupportedPreview}
    </div>
  );
}

export default async function MaterialDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const material = await prisma.courseMaterial.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      fileType: true,
      category: true,
      createdAt: true
    }
  });

  if (!material) {
    notFound();
  }

  return (
    <AppShell
      title={material.title}
      description={TEXT.uploadedAt
        .replace("{time}", formatDateTime(material.createdAt))
        .replace("{fileName}", material.fileName)}
      actions={
        <Link
          href={`/api/files/${material.id}?kind=material&download=1`}
          className={buttonVariants({ variant: "outline" })}
        >
          {TEXT.downloadFile}
        </Link>
      }
    >
      <PageShell>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{materialFileTypeLabel(material.fileType)}</Badge>
          <Badge variant="outline">{materialCategoryLabel(material.category)}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{TEXT.previewTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[680px] min-h-[460px] resize-y overflow-auto rounded-2xl">
              {renderPreview(material.id, material.mimeType)}
            </div>
          </CardContent>
        </Card>
      </PageShell>
    </AppShell>
  );
}
