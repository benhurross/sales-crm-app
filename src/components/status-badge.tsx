import { Badge } from "@/components/ui/badge";

const variants: Record<string, string> = {
  Secured: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  Lost: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
  Active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  Resigned: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/25",
  Transferred: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
  Deactivated: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {status}
    </Badge>
  );
}
