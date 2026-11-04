import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Sales performance overview" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["Total Leads", "Secured", "Pending", "Lost"].map((label) => (
          <div key={label} className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">--</p>
          </div>
        ))}
      </div>
    </div>
  );
}
