import { WritingUploadForm } from "@/components/assignment/writing-upload-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { requireAuth } from "@/lib/auth/session";

export default async function NewWritingAssignmentPage() {
  await requireAuth();
  return (
    <AppShell
      title="上传笔头作业"
      description="支持本地文本直读和 Kimi Files API 两种解析路径，系统会自动选择更合适的结构化方式。"
    >
      <PageShell>
        <WritingUploadForm />
      </PageShell>
    </AppShell>
  );
}
