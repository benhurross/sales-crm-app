import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and user management" />
      <div className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
        <p className="text-muted-foreground">Settings module coming in Phase 9.</p>
      </div>
    </div>
  );
}
