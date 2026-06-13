"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AssignmentTitleEditor({
  endpoint,
  initialTitle
}: {
  endpoint: string;
  initialTitle: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error("作业名称不能为空。");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: nextTitle })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "作业名称更新失败。");
      }

      toast.success("作业名称已更新。");
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作业名称更新失败。");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        修改名称
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="min-w-60 sm:w-72"
        aria-label="作业名称"
      />
      <Button type="submit" disabled={saving}>
        {saving ? "保存中..." : "保存"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={saving}
        onClick={() => {
          setTitle(initialTitle);
          setEditing(false);
        }}
      >
        取消
      </Button>
    </form>
  );
}
