"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Medal, Pencil, Save, Trophy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatAmount } from "@/lib/format";
import { hasRole } from "@/lib/permissions";
import {
  achievementColor,
  achievementPct,
  progressColor,
  rankBySecured,
  type ProducerTarget,
} from "@/lib/targets";

export default function TargetsPage() {
  const user = useCurrentUser();
  const canEdit = hasRole(user.role, "manager");
  const queryClient = useQueryClient();
  const t = useTranslations("targets");
  const tc = useTranslations("common");

  const { data: targets = [], isLoading } = useQuery<ProducerTarget[]>({
    queryKey: ["targets"],
    queryFn: () => fetch("/api/targets").then((r) => r.json()),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAnnual, setEditAnnual] = useState("");
  const [editMonthly, setEditMonthly] = useState("");

  const updateMutation = useMutation({
    mutationFn: async ({ id, annualTarget, monthlyTarget }: { id: number; annualTarget: string; monthlyTarget: string }) => {
      const res = await fetch(`/api/targets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annualTarget, monthlyTarget }),
      });
      if (!res.ok) throw new Error(tc("failed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      toast.success(t("updated"));
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(row: ProducerTarget) {
    setEditingId(row.id);
    setEditAnnual(row.annualTarget);
    setEditMonthly(row.monthlyTarget);
  }

  const saveEdit = useCallback(
    (id: number) => updateMutation.mutate({ id, annualTarget: editAnnual || "0", monthlyTarget: editMonthly || "0" }),
    [updateMutation, editAnnual, editMonthly],
  );

  const columns = useMemo<LegacyColumnDef<ProducerTarget, unknown>[]>(
    () => [
      { accessorKey: "name", header: t("colProducer") },
      { accessorKey: "region", header: t("colRegion"), size: 90 },
      {
        accessorKey: "annualTarget",
        meta: { filter: "range" },
        header: t("colAnnual"),
        cell: ({ row }) => {
          if (editingId === row.original.id) {
            return (
              <Input
                type="number"
                className="h-7 w-32"
                value={editAnnual}
                onChange={(e) => setEditAnnual(e.target.value)}
              />
            );
          }
          const v = Number(row.original.annualTarget);
          return v > 0 ? formatAmount(v) : <span className="text-muted-foreground">--</span>;
        },
        sortingFn: (a: { original: ProducerTarget }, b: { original: ProducerTarget }) =>
          Number(a.original.annualTarget) - Number(b.original.annualTarget),
      },
      {
        accessorKey: "monthlyTarget",
        meta: { filter: "range" },
        header: t("colMonthly"),
        cell: ({ row }) => {
          if (editingId === row.original.id) {
            return (
              <Input
                type="number"
                className="h-7 w-32"
                value={editMonthly}
                onChange={(e) => setEditMonthly(e.target.value)}
              />
            );
          }
          const v = Number(row.original.monthlyTarget);
          return v > 0 ? formatAmount(v) : <span className="text-muted-foreground">--</span>;
        },
        sortingFn: (a: { original: ProducerTarget }, b: { original: ProducerTarget }) =>
          Number(a.original.monthlyTarget) - Number(b.original.monthlyTarget),
      },
      {
        id: "secured",
        header: t("colSecured"),
        accessorFn: (row) => Number(row.securedPremium),
        meta: { filter: "range" },
        cell: ({ row }) => formatAmount(Number(row.original.securedPremium)),
        sortingFn: (a: { original: ProducerTarget }, b: { original: ProducerTarget }) =>
          Number(a.original.securedPremium) - Number(b.original.securedPremium),
      },
      {
        id: "achievement",
        header: t("colAchievement"),
        accessorFn: (row) => achievementPct(row.securedPremium, row.annualTarget),
        meta: { filter: "range" },
        size: 180,
        cell: ({ row }) => {
          const pct = achievementPct(row.original.securedPremium, row.original.annualTarget);
          const capped = Math.min(pct, 100);
          return (
            <div className="flex items-center gap-2">
              <div className="w-20">
                <Progress value={capped} className="h-2" indicatorClassName={progressColor(pct)} />
              </div>
              <span className={`text-xs font-semibold tabular-nums ${achievementColor(pct)}`}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        },
        sortingFn: (a: { original: ProducerTarget }, b: { original: ProducerTarget }) =>
          achievementPct(a.original.securedPremium, a.original.annualTarget) -
          achievementPct(b.original.securedPremium, b.original.annualTarget),
      },
      ...(canEdit
        ? [
            {
              id: "actions",
              header: "",
              size: 80,
              enableSorting: false,
              cell: ({ row }) => {
                if (editingId === row.original.id) {
                  return (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-emerald-600" title={tc("save")} aria-label={tc("save")} onClick={() => saveEdit(row.original.id)}>
                        <Save className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" title={tc("cancel")} aria-label={tc("cancel")} onClick={() => setEditingId(null)}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  );
                }
                return (
                  <Button variant="ghost" size="icon" className="size-7" title={tc("edit")} aria-label={tc("edit")} onClick={() => startEdit(row.original)}>
                    <Pencil className="size-3.5" />
                  </Button>
                );
              },
            } satisfies LegacyColumnDef<ProducerTarget, unknown>,
          ]
        : []),
    ],
    [canEdit, editingId, editAnnual, editMonthly, saveEdit, t, tc],
  );

  const leaderboard = useMemo(() => rankBySecured(targets).slice(0, 10), [targets]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">{tc("loading")}</div>
      ) : (
        <>
          <DataTable columns={columns} data={targets} />

          {leaderboard.length > 0 && (
            <div className="rounded-xl border bg-card p-6 shadow-glass glass-sheen">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Trophy className="size-5 text-amber-500" />
                {t("leaderboard")}
              </h2>
              <div className="space-y-3">
                {leaderboard.map((p, i) => {
                  const pct = achievementPct(p.securedPremium, p.annualTarget);
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                        {i === 0 ? <Medal className="size-4 text-amber-500" /> : i === 1 ? <Medal className="size-4 text-zinc-400" /> : i === 2 ? <Medal className="size-4 text-amber-700" /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{p.name}</span>
                          <span className="shrink-0 tabular-nums">{formatAmount(Number(p.securedPremium))}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1">
                            <Progress value={Math.min(pct, 100)} className="h-1.5" indicatorClassName={progressColor(pct)} />
                          </div>
                          <span className={`text-xs font-medium tabular-nums ${achievementColor(pct)}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
