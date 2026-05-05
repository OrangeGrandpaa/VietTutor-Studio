"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

export function RecordingReviewForm({
  assignmentId,
  recording
}: {
  assignmentId: string;
  recording: {
    id: string;
    feedback?: {
      teacherSuggestion: string | null;
      overallScore: number | null;
    } | null;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(recording.feedback?.teacherSuggestion ?? "");

  const isCorrect = recording.feedback?.overallScore === null || recording.feedback?.overallScore === undefined
    ? null
    : recording.feedback.overallScore >= 100;

  async function submitReview(nextIsCorrect: boolean) {
    setSaving(true);

    try {
      const response = await fetch(`/api/assignments/speaking/${assignmentId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: recording.id,
          teacherSuggestion: note,
          overallScore: nextIsCorrect ? 100 : 0
        })
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "保存批阅失败。");
      }

      toast.success(payload?.message ?? "口语批阅已保存。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存批阅失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
      <Textarea
        className="min-h-[110px]"
        placeholder="批注"
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
