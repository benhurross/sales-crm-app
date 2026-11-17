"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/format";
import type { TeamWin } from "./celebration-host";

/** The team's latest secured deals, where colleagues can congratulate each other. */
export function RecentWins() {
  const queryClient = useQueryClient();
  const { data: wins = [], isLoading } = useQuery<TeamWin[]>({
    queryKey: ["wins", "team"],
    queryFn: () => fetch("/api/wins").then((r) => r.json()),
    refetchInterval: 60_000,
  });
  const [composing, setComposing] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const congratulate = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      const res = await fetch(`/api/wins/${id}/kudos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not send");
    },
    onSuccess: (_, { id }) => {
      const win = wins.find((w) => w.id === id);
      toast.success(`Congratulations sent to ${win?.producer.split(" ")[0] ?? "your colleague"}`);
      setComposing(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["wins", "team"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
  if (!wins.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">No wins recorded yet. The next secured lead will appear here.</p>;

  return (
    <ul className="max-h-[300px] divide-y divide-border/60 overflow-auto pr-1">
      {wins.map((w) => (
        <li key={w.id} className="py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <Trophy className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{w.isOwn ? "You" : w.producer}</span> secured{" "}
                <span className="font-medium">{w.client}</span>
                {w.premium !== null && <span className="text-muted-foreground"> · {formatAmount(Math.round(w.premium))}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(w.securedAt), { addSuffix: true })}
                {w.kudos.length > 0 && ` · ${w.kudos.length} congratulated`}
              </p>
              {w.kudos.some((k) => k.message) && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={w.kudos.filter((k) => k.message).map((k) => `${k.name}: ${k.message}`).join("\n")}>
                  {w.kudos.filter((k) => k.message).map((k) => `${k.name.split(" ")[0]}: "${k.message}"`).join("  ")}
                </p>
              )}
              {composing === w.id && (
                <form
                  className="mt-2 flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    congratulate.mutate({ id: w.id, message: note });
                  }}
                >
                  <Input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add a note (optional)" className="h-8 text-sm" aria-label="Note" />
                  <Button type="submit" size="sm" disabled={congratulate.isPending}>Send</Button>
                </form>
              )}
            </div>
            {!w.isOwn &&
              (w.congratulated ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" /> Sent
                </span>
              ) : (
                composing !== w.id && (
                  <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => setComposing(w.id)}>
                    Congratulate
                  </Button>
                )
              ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
