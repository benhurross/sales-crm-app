export interface ProducerTarget {
  id: number;
  code: string;
  name: string;
  region: string;
  employmentStatus: string;
  leavingDate: string | null;
  annualTarget: string;
  monthlyTarget: string;
  securedPremium: string;
  securedCount: number;
  totalLeads: number;
}

export function achievementPct(secured: string | number, target: string | number): number {
  const t = Number(target);
  if (t <= 0) return 0;
  return (Number(secured) / t) * 100;
}

export function achievementColor(pct: number): string {
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 75) return "text-blue-600 dark:text-blue-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function progressColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function rankBySecured(producers: ProducerTarget[]): ProducerTarget[] {
  return [...producers].sort((a, b) => Number(b.securedPremium) - Number(a.securedPremium));
}
