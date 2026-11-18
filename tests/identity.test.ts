import { describe, expect, it } from "vitest";
import {
  matchUser,
  normalizeName,
  planProducerMerges,
  planUserMerges,
  sameName,
  type ProducerRecord,
  type UserRecord,
} from "@/lib/identity";

const producer = (p: Partial<ProducerRecord> & { id: number; name: string }): ProducerRecord => ({
  code: `J-${p.id}`,
  email: null,
  userId: null,
  annualTarget: "0",
  records: 0,
  ...p,
});
const user = (u: Partial<UserRecord> & { id: string; name: string }): UserRecord => ({ email: `${u.id}@x.com`, role: "salesman", ...u });

describe("names", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normalizeName("Bdoor Al-Olayan")).toBe("bdooralolayan");
    expect(sameName("Bdoor Al-Olayan", "bdoor alolayan")).toBe(true);
  });

  it("allows small spelling differences for the same first name", () => {
    expect(sameName("Sultanah Alsheheri", "Sultanah Alshehri")).toBe(true);
    expect(sameName("Fahad Almahmadi", "Fahad Al Mahmadi")).toBe(true);
  });

  it("keeps different people apart", () => {
    expect(sameName("Meshal Alharbi", "Meshal Alsulami")).toBe(false);
    expect(sameName("Abdulrahman Souri", "Abdulrahman Taha")).toBe(false);
    expect(sameName("Sara Abdulaziz", "Abdulaziz Alturki")).toBe(false);
  });
});

describe("planProducerMerges", () => {
  it("keeps the producer with a registered email and folds the other into it", () => {
    const merges = planProducerMerges([
      producer({ id: 14, name: "Sultanah Alshehri", records: 1260 }),
      producer({ id: 6, name: "Sultanah Alsheheri", email: "s.alshehri@applus.com.sa", userId: "u6", records: 150 }),
      producer({ id: 5, name: "Fahad Almahmadi", email: "f@applus.com.sa" }),
    ]);
    expect(merges).toHaveLength(1);
    expect(merges[0].keep.id).toBe(6);
    expect(merges[0].remove.map((p) => p.id)).toEqual([14]);
  });

  it("matches duplicates by email even when names differ", () => {
    const merges = planProducerMerges([
      producer({ id: 1, name: "F. Almahmadi", email: "F@applus.com.sa" }),
      producer({ id: 2, name: "Fahad Almahmadi", email: "f@applus.com.sa", userId: "u" }),
    ]);
    expect(merges[0].keep.id).toBe(2);
  });
});

describe("planUserMerges", () => {
  it("keeps the account whose email is registered on the producer and the highest role", () => {
    const merges = planUserMerges(
      [
        user({ id: "new", name: "Fahad Almahmadi", email: "fahad@gmail.com", role: "manager" }),
        user({ id: "etl", name: "Fahad Almahmadi", email: "f.almahmadi@applus.com.sa" }),
        user({ id: "other", name: "Dan Shorbatli" }),
      ],
      ["f.almahmadi@applus.com.sa"],
    );
    expect(merges).toEqual([
      { keep: expect.objectContaining({ id: "etl" }), remove: [expect.objectContaining({ id: "new" })], role: "manager" },
    ]);
  });

  it("prefers a company email when none is registered", () => {
    const [m] = planUserMerges(
      [user({ id: "a", name: "Doaa Akhtabi", email: "doaa@gmail.com" }), user({ id: "b", name: "Doaa Akhtabi", email: "d.akhtabi@applus.com.sa" })],
      [],
    );
    expect(m.keep.id).toBe("b");
  });
});

describe("matchUser", () => {
  const users = [
    user({ id: "u1", name: "AlHassan Alsayed", email: "a.alsayed@applus.com.sa", role: "manager" }),
    user({ id: "u2", name: "Joseph Rosas", role: "admin" }),
    user({ id: "u3", name: "Meshal Alharbi", email: "m.alharbi@applus.com.sa" }),
  ];

  it("matches by email first, then by name", () => {
    expect(matchUser({ name: "Someone", email: "M.Alharbi@applus.com.sa" }, users)?.id).toBe("u3");
    expect(matchUser({ name: "AlHassan Alsayed", email: null }, users)?.id).toBe("u1");
  });

  it("never links a producer to an admin by name, and skips unknown people", () => {
    expect(matchUser({ name: "Joseph Rosas", email: null }, users)).toBeUndefined();
    expect(matchUser({ name: "Sara Abdulaziz", email: null }, users)).toBeUndefined();
  });
});
