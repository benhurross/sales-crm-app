/** What makes a secured lead worth celebrating, beyond the win itself. */

export interface Win {
  premium: number;
  /** null for wins secured before the date was recorded. */
  securedAt: Date | null;
}

export interface Celebration {
  /** A bigger celebration for wins that hit a milestone. */
  big: boolean;
  milestones: string[];
}

export const TARGET_STEPS = [25, 50, 75, 100];

const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Monday 00:00 of the week containing `date`. */
function weekStart(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * Milestones reached by `win`, judged against the salesman's other wins that came before it.
 * Wins without a date count toward totals and personal bests but not toward monthly or weekly ones.
 */
export function celebrationFor(win: Required<Win> & { securedAt: Date }, otherWins: Win[], annualTarget: number): Celebration {
  const earlier = otherWins.filter((w) => !w.securedAt || w.securedAt < win.securedAt);
  const milestones: string[] = [];

  if (!earlier.some((w) => w.securedAt && sameMonth(w.securedAt, win.securedAt))) milestones.push("Your first win this month");

  const best = Math.max(0, ...earlier.map((w) => w.premium));
  if (earlier.length > 0 && win.premium > best) milestones.push("A new personal best deal");

  if (annualTarget > 0) {
    const before = earlier.reduce((s, w) => s + w.premium, 0) / annualTarget;
    const after = before + win.premium / annualTarget;
    const crossed = TARGET_STEPS.filter((step) => before * 100 < step && after * 100 >= step).pop();
    if (crossed === 100) milestones.push("You reached your annual target");
    else if (crossed) milestones.push(`You passed ${crossed}% of your annual target`);
  }

  const week = weekStart(win.securedAt);
  const thisWeek = 1 + earlier.filter((w) => w.securedAt && weekStart(w.securedAt) === week).length;
  if (thisWeek >= 3) milestones.push(`${thisWeek} wins this week`);

  return { big: milestones.some((m) => m !== "Your first win this month") || win.premium >= 100_000, milestones };
}
