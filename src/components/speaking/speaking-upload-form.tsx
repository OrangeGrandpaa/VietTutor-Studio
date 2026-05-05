"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const assignmentFileAccept =
  ".md,.markdown,.txt,.doc,.docx,.pdf,.ppt,.pptx,.xls,.xlsx,.csv,.html,.htm,.json,.xml,.log,text/markdown,text/plain,text/csv,text/html,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,application/xml,text/xml";

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
          Markdown、DOC、DOCX 会直接读文本后一次请求调用 Kimi；PDF、PPT、Excel 等复杂文档会自动走 Kimi Files API。
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
            {loading ? "上传并处理中..." : "上传口语作业"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
