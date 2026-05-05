import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { MaterialUploadForm } from "@/components/materials/material-upload-form";
import { requireAuth } from "@/lib/auth/session";

export default async function NewMaterialPage() {
  await requireAuth();
  return (
    <AppShell title="上传课件" description="上传后不会暴露到 public 目录，所有访问都通过受保护 API。">
      <PageShell>
        <MaterialUploadForm />
      </PageShell>
    </AppShell>
  );
}
