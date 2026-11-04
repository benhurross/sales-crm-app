import { PageHeader } from "@/components/page-header";

export default function TargetsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Targets" description="Sales targets and achievements" />
      <div className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
        <p className="text-muted-foreground">Targets module coming in Phase 4.</p>
      </div>
    </div>
  );
}
