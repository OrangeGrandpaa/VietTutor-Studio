"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TEXT = {
  formTitle: "\u66f4\u65b0\u5b66\u4e60\u8fdb\u5ea6",
  title: "\u6807\u9898",
  progressStatus: "\u5b66\u4e60\u72b6\u6001",
  notStarted: "\u672a\u5f00\u59cb",
  inProgress: "\u5b66\u4e60\u4e2d",
  completed: "\u5df2\u5b8c\u6210",
  needsReview: "\u9700\u8981\u590d\u4e60",
  currentPage: "\u5f53\u524d\u9875\u6570",
  totalPages: "\u603b\u9875\u6570",
  totalPagesPlaceholder: "\u4f8b\u5982\uff1a120",
  completionPercent: "\u5b8c\u6210\u767e\u5206\u6bd4",
  percentHelper: "\u5c06\u6839\u636e\u5f53\u524d\u9875\u6570\u548c\u603b\u9875\u6570\u81ea\u52a8\u8ba1\u7b97",
  note: "\u5907\u6ce8",
  save: "\u4fdd\u5b58\u8fdb\u5ea6",
  saving: "\u4fdd\u5b58\u4e2d...",
  updateFailed: "\u66f4\u65b0\u5931\u8d25\u3002",
  updated: "\u5b66\u4e60\u8fdb\u5ea6\u5df2\u66f4\u65b0\u3002",
  invalidCurrentPageRequired: "\u8bf7\u8f93\u5165\u5f53\u524d\u9875\u6570\u3002",
  invalidTotalPages: "\u8bf7\u8f93\u5165\u5927\u4e8e 0 \u7684\u603b\u9875\u6570\u3002",
  invalidCurrentPage:
    "\u5f53\u524d\u9875\u6570\u4e0d\u80fd\u8d85\u8fc7\u603b\u9875\u6570\uff0c\u8bf7\u68c0\u67e5\u540e\u91cd\u8bd5\u3002"
} as const;

function toOptionalNumber(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function calculateProgressPercent(currentPage?: number, totalPages?: number) {
  if (
    typeof currentPage !== "number" ||
    typeof totalPages !== "number" ||
    totalPages <= 0 ||
    currentPage < 0
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((currentPage / totalPages) * 100)));
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
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentPageInput, setCurrentPageInput] = useState(material.currentPage?.toString() ?? "");
  const [totalPagesInput, setTotalPagesInput] = useState("");
  const computedPercent = calculateProgressPercent(
    toOptionalNumber(currentPageInput),
    toOptionalNumber(totalPagesInput)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEXT.formTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);

            const formData = new FormData(event.currentTarget);
            const currentPage = toOptionalNumber(formData.get("currentPage")?.toString() ?? "");
            const totalPages = toOptionalNumber(formData.get("totalPages")?.toString() ?? "");

            if (typeof currentPage !== "number" || currentPage <= 0) {
              toast.error(TEXT.invalidCurrentPageRequired);
              setLoading(false);
              return;
            }

            if (typeof totalPages !== "number" || totalPages <= 0) {
              toast.error(TEXT.invalidTotalPages);
              setLoading(false);
              return;
            }

            if (typeof currentPage === "number" && currentPage > totalPages) {
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
                  progressPercent: calculateProgressPercent(currentPage, totalPages) ?? 0,
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

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="completionPercent">{TEXT.completionPercent}</Label>
              <Input
                id="completionPercent"
                name="completionPercent"
                value={computedPercent ?? material.progressPercent}
                readOnly
                placeholder={TEXT.percentHelper}
              />
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

            <div className="space-y-2">
              <Label htmlFor="totalPages">{TEXT.totalPages}</Label>
              <Input
                id="totalPages"
                name="totalPages"
                type="number"
                min="1"
                value={totalPagesInput}
                onChange={(event) => setTotalPagesInput(event.target.value)}
                placeholder={TEXT.totalPagesPlaceholder}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{TEXT.percentHelper}</p>

          <div className="space-y-2">
            <Label htmlFor="note">{TEXT.note}</Label>
            <Textarea id="note" name="note" defaultValue={material.note ?? ""} />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? TEXT.saving : TEXT.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
