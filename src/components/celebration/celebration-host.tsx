"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { PartyPopper, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAmount } from "@/lib/format";
import { hasRole } from "@/lib/permissions";
import { playChime } from "./sound";

interface MyWins {
  celebrations: { id: number; client: string; premium: number; big: boolean; milestones: string[] }[];
  kudos: { id: number; from: string; message: string | null; client: string }[];
}
export interface TeamWin {
  id: number;
  client: string;
  producer: string;
  premium: number | null;
  securedAt: string;
  isOwn: boolean;
  congratulated: boolean;
  kudos: { name: string; message: string | null }[];
}

const COLORS = ["#0047ba", "#0f9d84", "#10b981", "#f59e0b", "#3f86f2"];
const LAST_TEAM_WIN = "last-team-win";

function burst(big: boolean) {
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 100 };
  confetti({ ...base, particleCount: big ? 160 : 80, spread: big ? 100 : 70, origin: { y: 0.6 } });
  if (!big) return;
  setTimeout(() => confetti({ ...base, particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 250);
  setTimeout(() => confetti({ ...base, particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 400);
}

const firstName = (name: string) => name.split(/\s+/)[0];

/** Celebrates the signed-in salesman's new wins, passes on colleagues' congratulations, and tells managers about team wins. */
export function CelebrationHost() {
  const user = useCurrentUser();
  const isManager = hasRole(user.role, "manager");
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery<MyWins>({
    queryKey: ["wins", "me"],
    queryFn: () => fetch("/api/wins/me").then((r) => r.json()),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: team } = useQuery<TeamWin[]>({
    queryKey: ["wins", "team"],
    queryFn: () => fetch("/api/wins").then((r) => r.json()),
    refetchInterval: 60_000,
    enabled: isManager,
  });

  const seen = useMutation({
    mutationFn: (body: { celebrated?: number[]; kudosSeen?: number[] }) =>
      fetch("/api/wins/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wins"] }),
  });

  const current = data?.celebrations[0];
  const remaining = (data?.celebrations.length ?? 0) - 1;

  const celebrated = useRef(new Set<number>());
  useEffect(() => {
    if (!current || celebrated.current.has(current.id)) return;
    celebrated.current.add(current.id);
    burst(current.big);
    playChime(current.big);
  }, [current]);

  // Congratulations from colleagues, grouped per win
  const shownKudos = useRef(new Set<number>());
  useEffect(() => {
    const fresh = (data?.kudos ?? []).filter((k) => !shownKudos.current.has(k.id));
    if (!fresh.length) return;
    fresh.forEach((k) => shownKudos.current.add(k.id));
    const byClient = Map.groupBy(fresh, (k) => k.client);
    for (const [client, list] of byClient) {
      const names = list.map((k) => firstName(k.from));
      const who = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} others` : names.join(" and ");
      const notes = list.filter((k) => k.message).map((k) => `${firstName(k.from)}: "${k.message}"`);
      toast(`${who} congratulated you on ${client}`, { description: notes.join("  ") || undefined, icon: <Trophy className="size-4 text-amber-500" />, duration: 8000 });
    }
    seen.mutate({ kudosSeen: fresh.map((k) => k.id) });
  }, [data?.kudos, seen]);

  // Managers: a notice for each team win since they last looked
  useEffect(() => {
    if (!team?.length) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_TEAM_WIN);
    } catch {}
    const newest = team[0].securedAt;
    if (last) {
      for (const w of team.filter((w) => w.securedAt > last! && !w.isOwn).reverse())
        toast(`${w.producer} secured ${w.client}`, {
          description: w.premium !== null ? formatAmount(Math.round(w.premium)) : undefined,
          icon: <PartyPopper className="size-4 text-emerald-500" />,
          action: { label: "View wins", onClick: () => router.push("/#recent-wins") },
          duration: 10_000,
        });
    }
    try {
      localStorage.setItem(LAST_TEAM_WIN, newest);
    } catch {}
  }, [team, router]);

  if (!current) return null;
  const close = () => seen.mutate({ celebrated: [current.id] });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-sm text-center sm:max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-1 flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
            <Trophy className="size-7 text-emerald-500" />
          </div>
          <DialogTitle className="text-xl">Congratulations, {firstName(user.name)}!</DialogTitle>
          <DialogDescription className="text-base text-foreground">
            You secured <b>{current.client}</b>
            <span className="mt-1 block text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{formatAmount(Math.round(current.premium))}</span>
          </DialogDescription>
        </DialogHeader>
        {current.milestones.length > 0 && (
          <ul className="space-y-1.5">
            {current.milestones.map((m) => (
              <li key={m} className="rounded-md bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
                {m}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">Every win counts. The whole team is celebrating with you.</p>
        <DialogFooter className="sm:justify-center">
          <Button onClick={close} autoFocus>
            {remaining > 0 ? `Next win (${remaining} more)` : "Thank you"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
