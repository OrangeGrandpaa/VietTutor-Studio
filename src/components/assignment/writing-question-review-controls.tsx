"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

export function WritingQuestionReviewControls({
  assignmentId,
  sectionId,
  isCorrect,
  initialNote
}: {
  assignmentId: string;
  sectionId: string;
  isCorrect: boolean | null;
  initialNote: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(initialNote);

  async function submitReview(nextIsCorrect: boolean) {
    setSaving(true);

    try {
      const response = await fetch(`/api/assignments/writing/${assignmentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          isCorrect: nextIsCorrect,
          note
        })
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message ?? "保存批阅失败。");
      }

      toast.success(result?.message ?? "批阅已保存。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存批阅失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Textarea
        className="min-h-[96px]"
        placeholder="输入批注"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={isCorrect === true ? "default" : "outline"}
          className={cn(
            isCorrect === true
              ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
            isCorrect === false ? "opacity-60" : ""
          )}
          disabled={saving}
          onClick={() => submitReview(true)}
        >
          {saving ? "保存中..." : isCorrect === true ? "已判正确" : "正确"}
        </Button>
        <Button
          type="button"
          variant={isCorrect === false ? "destructive" : "outline"}
          className={cn(
            isCorrect === false
              ? "bg-red-600 text-white hover:bg-red-600/90"
              : "border-red-200 text-red-600 hover:bg-red-50",
            isCorrect === true ? "opacity-60" : ""
          )}
          disabled={saving}
          onClick={() => submitReview(false)}
        >
          {saving ? "保存中..." : isCorrect === false ? "已判错误" : "错误"}
        </Button>
      </div>
    </div>
  );
}
