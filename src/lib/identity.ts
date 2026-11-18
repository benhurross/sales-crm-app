/** Matching rules for tying salesmen (producers) to their login accounts and merging duplicates. */

export interface ProducerRecord {
  id: number;
  code: string;
  name: string;
  email: string | null;
  userId: string | null;
  annualTarget: string;
  records: number; // leads + prospects
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_RANK: Record<string, number> = { salesman: 0, manager: 1, admin: 2 };

/** Lowercase letters only, so "Bdoor Al-Olayan" and "bdoor alolayan" compare equal. */
export function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Same person: same first name and the full names differ by at most two letters (e.g. "Alsheheri" / "Alshehri"). */
export function sameName(a: string, b: string): boolean {
  const first = (s: string) => normalizeName(s.trim().split(/\s+/)[0] ?? "");
  if (first(a) !== first(b)) return false;
  return editDistance(normalizeName(a), normalizeName(b)) <= 2;
}

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function clusters<T>(items: T[], same: (a: T, b: T) => boolean): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const group = groups.find((g) => g.some((x) => same(x, item)));
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups;
}

export interface ProducerMerge {
  keep: ProducerRecord;
  remove: ProducerRecord[];
}

/** Duplicate producers for the same person; the one with a registered email is kept. */
export function planProducerMerges(producers: ProducerRecord[]): ProducerMerge[] {
  return clusters(producers, (a, b) => sameEmail(a.email, b.email) || sameName(a.name, b.name))
    .filter((g) => g.length > 1)
    .map((g) => {
      const [keep, ...remove] = [...g].sort(
        (a, b) =>
          Number(!!b.email) - Number(!!a.email) ||
          Number(!!b.userId) - Number(!!a.userId) ||
          b.records - a.records ||
          a.id - b.id,
      );
      return { keep, remove };
    });
}

export interface UserMerge {
  keep: UserRecord;
  remove: UserRecord[];
  role: string;
}

/**
 * Duplicate accounts for the same person. The one whose email is registered on a producer is kept,
 * then a company email, then the oldest; the kept account gets the highest role of the group.
 */
export function planUserMerges(users: UserRecord[], producerEmails: string[]): UserMerge[] {
  const registered = (u: UserRecord) => producerEmails.some((e) => sameEmail(e, u.email));
  const company = (u: UserRecord) => /@applus\./i.test(u.email);
  return clusters(users, (a, b) => sameName(a.name, b.name))
    .filter((g) => g.length > 1)
    .map((g) => {
      const [keep, ...remove] = [...g].sort(
        (a, b) => Number(registered(b)) - Number(registered(a)) || Number(company(b)) - Number(company(a)),
      );
      const role = g.reduce((r, u) => ((ROLE_RANK[u.role] ?? 0) > (ROLE_RANK[r] ?? 0) ? u.role : r), keep.role);
      return { keep, remove, role };
    });
}

/** The account a producer should be linked to: same email first, otherwise the only account with the same name. */
export function matchUser(producer: Pick<ProducerRecord, "name" | "email">, users: UserRecord[]): UserRecord | undefined {
  const byEmail = users.find((u) => sameEmail(u.email, producer.email));
  if (byEmail) return byEmail;
  const byName = users.filter((u) => u.role !== "admin" && sameName(u.name, producer.name));
  return byName.length === 1 ? byName[0] : undefined;
}
