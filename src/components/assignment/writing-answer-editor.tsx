"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function WritingAnswerEditor({
  assignmentId,
  sectionId,
  initialAnswer
}: {
  assignmentId: string;
  sectionId: string;
  initialAnswer: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState(initialAnswer);
  const [saving, setSaving] = useState(false);
  const isDirty = answer !== initialAnswer;

  async function saveAnswer() {
    setSaving(true);

    try {
      const response = await fetch(`/api/assignments/writing/${assignmentId}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          answer
        })
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message ?? "保存学生答案失败。");
      }

      toast.success(result?.message ?? "学生答案已保存。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存学生答案失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <Textarea
        className="min-h-[128px]"
        placeholder="在这里输入学生答案"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <Button type="button" variant="outline" disabled={saving || !isDirty} onClick={saveAnswer}>
        {saving ? "保存中..." : isDirty ? "保存答案" : "答案已保存"}
      </Button>
    </div>
  );
}
