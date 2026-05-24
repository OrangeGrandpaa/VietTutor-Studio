"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const TEXT = {
  formTitle: "\u66f4\u65b0\u5b66\u4e60\u8fdb\u5ea6",
  title: "\u6807\u9898",
  progressStatus: "\u5b66\u4e60\u72b6\u6001",
  notStarted: "\u672a\u5f00\u59cb",
  inProgress: "\u5b66\u4e60\u4e2d",
  completed: "\u5df2\u5b8c\u6210",
  needsReview: "\u9700\u8981\u590d\u4e60",
  currentPage: "\u5f53\u524d\u9875\u6570",
  detectedPages: "\u7cfb\u7edf\u5df2\u8bc6\u522b\uff1a\u5171 {total} \u9875\uff0c\u5b8c\u6210\u5ea6\u5c06\u81ea\u52a8\u8ba1\u7b97\u3002",
  unknownPages: "\u672a\u80fd\u81ea\u52a8\u8bc6\u522b\u603b\u9875\u6570\uff0c\u672c\u6b21\u4ec5\u4fdd\u5b58\u5b66\u4e60\u4f4d\u7f6e\u3002",
  note: "\u5907\u6ce8",
  save: "\u4fdd\u5b58\u8fdb\u5ea6",
  saving: "\u4fdd\u5b58\u4e2d...",
  updateFailed: "\u66f4\u65b0\u5931\u8d25\u3002",
  updated: "\u5b66\u4e60\u8fdb\u5ea6\u5df2\u66f4\u65b0\u3002",
  invalidCurrentPageRequired: "\u8bf7\u8f93\u5165\u5f53\u524d\u9875\u6570\u3002",
  invalidCurrentPage:
    "\u5f53\u524d\u9875\u6570\u4e0d\u80fd\u8d85\u8fc7\u8bfe\u4ef6\u603b\u9875\u6570\uff0c\u8bf7\u68c0\u67e5\u540e\u91cd\u8bd5\u3002"
} as const;

function toOptionalNumber(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function MaterialProgressForm({
  material
}: {
  material: {
    id: string;
    title: string;
    note: string | null;
    progressStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW";
    progressPercent: number;
    currentPage: number | null;
    totalPages: number | null;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentPageInput, setCurrentPageInput] = useState(material.currentPage?.toString() ?? "");
  const [noteInput, setNoteInput] = useState(material.note ?? "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{TEXT.formTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);

            const formData = new FormData(event.currentTarget);
            const currentPage = toOptionalNumber(formData.get("currentPage")?.toString() ?? "");

            if (typeof currentPage !== "number" || currentPage <= 0) {
              toast.error(TEXT.invalidCurrentPageRequired);
              setLoading(false);
              return;
            }

            if (typeof material.totalPages === "number" && currentPage > material.totalPages) {
              toast.error(TEXT.invalidCurrentPage);
              setLoading(false);
              return;
            }

            try {
              const response = await fetch(`/api/materials/${material.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: formData.get("title")?.toString(),
                  note: formData.get("note")?.toString(),
                  progressStatus: formData.get("progressStatus")?.toString(),
                  currentPage
                })
              });

              const payload = (await response.json().catch(() => null)) as { message?: string } | null;

              if (!response.ok) {
                throw new Error(payload?.message ?? TEXT.updateFailed);
              }

              toast.success(TEXT.updated);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : TEXT.updateFailed);
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="title">{TEXT.title}</Label>
            <Input id="title" name="title" defaultValue={material.title} />
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="progressStatus">{TEXT.progressStatus}</Label>
              <Select id="progressStatus" name="progressStatus" defaultValue={material.progressStatus}>
                <option value="NOT_STARTED">{TEXT.notStarted}</option>
                <option value="IN_PROGRESS">{TEXT.inProgress}</option>
                <option value="COMPLETED">{TEXT.completed}</option>
                <option value="NEEDS_REVIEW">{TEXT.needsReview}</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentPage">{TEXT.currentPage}</Label>
              <Input
                id="currentPage"
                name="currentPage"
                type="number"
                min="1"
                value={currentPageInput}
                onChange={(event) => setCurrentPageInput(event.target.value)}
              />
            </div>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            {typeof material.totalPages === "number"
              ? TEXT.detectedPages.replace("{total}", String(material.totalPages))
              : TEXT.unknownPages}
          </p>

          <div className="space-y-2">
            <Label htmlFor="note">{TEXT.note}</Label>
            <AutoResizeTextarea
              id="note"
              name="note"
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? TEXT.saving : TEXT.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
