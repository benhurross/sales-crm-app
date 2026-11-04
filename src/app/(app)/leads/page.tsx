import { PageHeader } from "@/components/page-header";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Manage sales leads and prospects" />
      <div className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
        <p className="text-muted-foreground">Leads module coming in Phase 3.</p>
      </div>
    </div>
  );
}
