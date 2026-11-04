import { PageHeader } from "@/components/page-header";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Sales reports and analytics" />
      <div className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
        <p className="text-muted-foreground">Reports module coming in Phase 7.</p>
      </div>
    </div>
  );
}
