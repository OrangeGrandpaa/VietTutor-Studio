"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const assignmentFileAccept =
  ".txt,.md,.markdown,.rtf,.doc,.docx,text/plain,text/markdown,text/rtf,application/rtf,application/x-rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type WritingUploadResponse = {
  id?: string;
  message?: string;
};

export function WritingUploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传笔头作业</CardTitle>
        <CardDescription>
          支持 TXT、Markdown、RTF、DOC 和 DOCX 文件，上传后会进入 AI 结构化流程。
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
              const response = await fetch("/api/assignments/writing", {
                method: "POST",
                body: formData
              });

              const responseText = await response.text();
              let payload: WritingUploadResponse | null = null;

              try {
                payload = responseText ? (JSON.parse(responseText) as WritingUploadResponse) : null;
              } catch {
                payload = null;
              }

              if (!response.ok || !payload?.id) {
                throw new Error(payload?.message ?? (responseText || "上传失败。"));
              }

              toast.success(payload.message ?? "上传成功。");
              router.push(`/assignments/writing/${payload.id}`);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "上传失败。");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="writing-title">标题</Label>
            <Input
              id="writing-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：第 3 课笔头练习"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="writing-file">作业文件</Label>
            <Input
              id="writing-file"
              type="file"
              accept={assignmentFileAccept}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "上传并处理中..." : "上传作业"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
