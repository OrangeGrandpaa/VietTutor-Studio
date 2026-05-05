import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { SpeakingUploadForm } from "@/components/speaking/speaking-upload-form";
import { requireAuth } from "@/lib/auth/session";

export default async function NewSpeakingAssignmentPage() {
  await requireAuth();
  return (
    <AppShell
      title="上传口语作业"
      description="支持本地文本直读和 Kimi Files API 两种解析路径，系统会自动拆成适合录音和逐条批阅的练习单元。"
    >
      <PageShell>
        <SpeakingUploadForm />
      </PageShell>
    </AppShell>
  );
}
