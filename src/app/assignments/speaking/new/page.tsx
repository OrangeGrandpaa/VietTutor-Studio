import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { SpeakingUploadForm } from "@/components/speaking/speaking-upload-form";
import { requireAuth } from "@/lib/auth/session";

export default async function NewSpeakingAssignmentPage() {
  await requireAuth();
  return (
    <AppShell
      title="上传口语作业"
      description="只支持 TXT 纯文本上传；系统本地按句拆分，不再调用 AI。"
    >
      <PageShell>
        <SpeakingUploadForm />
      </PageShell>
    </AppShell>
  );
}
