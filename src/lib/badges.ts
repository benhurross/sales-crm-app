/** Badges salesmen earn from their secured leads, and the Win of the Week. */

export type BadgeKey = "firstWin" | "hatTrick" | "fiveDealMonth" | "targetReached" | "dealOfQuarter";

export interface Badge {
  key: BadgeKey;
  /** For Deal of the Quarter, which quarter, e.g. "Q4 2026". */
  period?: string;
}

export interface SecuredWin {
  id: number;
  producerId: number;
  premium: number;
  /** null for wins secured before the date was recorded. */
  securedAt: Date | null;
}

export const BADGE_ORDER: BadgeKey[] = ["targetReached", "dealOfQuarter", "fiveDealMonth", "hatTrick", "firstWin"];

/** Monday 00:00 of the week containing `date`, as a timestamp. */
export function weekStart(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const quarterOf = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;

function countBy<T>(items: T[], key: (item: T) => string | number): Map<string | number, number> {
  const map = new Map<string | number, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

/**
 * Badges for each producer:
 * - First Win: any secured lead.
 * - Hat-trick: three wins in one Monday-to-Sunday week.
 * - Five-Deal Month: five wins in one calendar month.
 * - Target Reached: secured premium at or above the annual target.
 * - Deal of the Quarter: the team's biggest single win in a quarter (one badge per quarter).
 */
export function producerBadges(wins: SecuredWin[], annualTargets: Map<number, number>): Map<number, Badge[]> {
  const result = new Map<number, Badge[]>();
  const add = (producerId: number, badge: Badge) => result.set(producerId, [...(result.get(producerId) ?? []), badge]);

  const byProducer = Map.groupBy(wins, (w) => w.producerId);
  for (const [producerId, list] of byProducer) {
    const dated = list.filter((w) => w.securedAt) as (SecuredWin & { securedAt: Date })[];
    const target = annualTargets.get(producerId) ?? 0;
    if (target > 0 && list.reduce((s, w) => s + w.premium, 0) >= target) add(producerId, { key: "targetReached" });
    if ([...countBy(dated, (w) => monthKey(w.securedAt)).values()].some((n) => n >= 5)) add(producerId, { key: "fiveDealMonth" });
    if ([...countBy(dated, (w) => weekStart(w.securedAt)).values()].some((n) => n >= 3)) add(producerId, { key: "hatTrick" });
    add(producerId, { key: "firstWin" });
  }

  const byQuarter = Map.groupBy(
    wins.filter((w) => w.securedAt),
    (w) => quarterOf(w.securedAt!),
  );
  for (const [period, list] of byQuarter) {
    const best = list.reduce((a, b) => (b.premium > a.premium ? b : a));
    add(best.producerId, { key: "dealOfQuarter", period });
  }

  for (const [id, badges] of result) result.set(id, badges.sort((a, b) => BADGE_ORDER.indexOf(a.key) - BADGE_ORDER.indexOf(b.key)));
  return result;
}

/** The biggest win of the current week, or of last week when there is none yet this week. */
export function winOfTheWeek<T extends SecuredWin>(wins: T[], today: Date): { win: T; week: "this" | "last" } | null {
  const thisWeek = weekStart(today);
  const lastWeek = weekStart(new Date(thisWeek - 86_400_000));
  for (const [week, start] of [["this", thisWeek], ["last", lastWeek]] as const) {
    const inWeek = wins.filter((w) => w.securedAt && weekStart(w.securedAt) === start && w.securedAt <= today);
    if (inWeek.length) return { win: inWeek.reduce((a, b) => (b.premium > a.premium ? b : a)), week };
  }
  return null;
}
