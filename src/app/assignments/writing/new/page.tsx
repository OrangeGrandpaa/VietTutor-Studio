import { WritingUploadForm } from "@/components/assignment/writing-upload-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { requireAuth } from "@/lib/auth/session";

export default async function NewWritingAssignmentPage() {
  await requireAuth();
  return (
    <AppShell
      title="上传笔头作业"
      description="仅支持 TXT、Markdown、RTF、DOC、DOCX 文件，上传后会自动抽取文本并进入 AI 结构化。"
    >
      <PageShell>
        <WritingUploadForm />
      </PageShell>
    </AppShell>
  );
}
