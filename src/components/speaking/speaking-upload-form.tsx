"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const assignmentFileAccept = ".txt,text/plain";

export function SpeakingUploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传口语练习</CardTitle>
        <CardDescription>
          口语作业只接收 TXT 纯文本，不再调用 AI。系统会按 ; 或 . 等句末标点拆成可逐句录音的朗读文本。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();

            if (!file) {
              toast.error("请先选择文件。");
              return;
            }

            setLoading(true);
            const formData = new FormData();
            formData.append("title", title);
            formData.append("file", file);

            try {
              const response = await fetch("/api/assignments/speaking", {
                method: "POST",
                body: formData
              });
              const payload = (await response.json().catch(() => null)) as
                | { id?: string; message?: string }
                | null;

              if (!response.ok || !payload?.id) {
                throw new Error(payload?.message ?? "上传失败。");
              }

              toast.success(payload.message ?? "上传成功。");
              router.push(`/assignments/speaking/${payload.id}`);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "上传失败。");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="speaking-title">标题</Label>
            <Input
              id="speaking-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：第 4 课口语练习"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="speaking-file">练习文件</Label>
            <Input
              id="speaking-file"
              type="file"
              accept={assignmentFileAccept}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "上传并拆句中..." : "上传并按句拆分"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
