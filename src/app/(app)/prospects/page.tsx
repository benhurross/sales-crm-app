import { PageHeader } from "@/components/page-header";

export default function ProspectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Prospects" description="Prospect client pipeline" />
      <div className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
        <p className="text-muted-foreground">Prospects module coming in Phase 6.</p>
      </div>
    </div>
  );
}
