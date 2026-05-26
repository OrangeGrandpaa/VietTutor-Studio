"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const categories = [
  ["PRONUNCIATION", "\u53d1\u97f3"],
  ["VOCABULARY", "\u8bcd\u6c47"],
  ["GRAMMAR", "\u8bed\u6cd5"],
  ["LISTENING", "\u542c\u529b"],
  ["SPEAKING", "\u53e3\u8bed"],
  ["READING", "\u9605\u8bfb"],
  ["WRITING", "\u5199\u4f5c"],
  ["INTEGRATED", "\u7efc\u5408"]
] as const;

type UploadPayload = {
  success?: boolean;
  material?: { id: string };
  message?: string;
} | null;

function parseUploadPayload(rawText: string): UploadPayload {
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as UploadPayload;
  } catch {
    return null;
  }
}

function extractResponseMessage(rawText: string, status: number, payload: UploadPayload) {
  if (payload?.message) {
    return payload.message;
  }

  const normalizedText = rawText.trim();

  if (!normalizedText) {
    return `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u670d\u52a1\u5668\u8fd4\u56de\u5f02\u5e38\uff08HTTP ${status}\uff09\u3002`;
  }

  if (normalizedText.startsWith("<!DOCTYPE") || normalizedText.startsWith("<html")) {
    return `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u670d\u52a1\u5668\u8fd4\u56de\u4e86\u975e JSON \u9519\u8bef\u9875\uff08HTTP ${status}\uff09\u3002`;
  }

  return `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a${normalizedText}`;
}

export function MaterialUploadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传课件</CardTitle>
        <CardDescription>文件会保存到受保护的本地 uploads 目录，并通过鉴权后的 API 访问。</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);

            try {
              const formData = new FormData(event.currentTarget);
              const response = await fetch("/api/materials", {
                method: "POST",
                body: formData
              });

              const rawText = await response.text();
              const payload = parseUploadPayload(rawText);

              if (!response.ok || !payload?.material) {
                throw new Error(extractResponseMessage(rawText, response.status, payload));
              }

              toast.success("\u8bfe\u4ef6\u4e0a\u4f20\u6210\u529f\u3002");
              router.push(`/materials/${payload.material.id}`);
              router.refresh();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u672a\u77e5\u9519\u8bef\u3002"
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="material-file">课件文件</Label>
            <Input id="material-file" name="file" type="file" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material-title">标题</Label>
            <Input id="material-title" name="title" placeholder="例如：第 5 课听力材料" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material-category">课件分类</Label>
            <Select id="material-category" name="category" defaultValue="INTEGRATED">
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "上传中..." : "上传课件"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
