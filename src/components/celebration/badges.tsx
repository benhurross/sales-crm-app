"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, Flame, Gem, Sparkles, Star, Target, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/i18n/config";
import type { Badge, BadgeKey } from "@/lib/badges";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Highlights {
  badges: Record<string, Badge[]>;
  mine: Badge[];
  winOfTheWeek: {
    week: "this" | "last";
    id: number;
    client: string;
    producer: string;
    premium: number | null;
    securedAt: string;
    isOwn: boolean;
    kudos: number;
  } | null;
}

const STYLE: Record<BadgeKey, { icon: LucideIcon; color: string }> = {
  targetReached: { icon: Target, color: "text-emerald-600 bg-emerald-500/15 dark:text-emerald-400" },
  dealOfQuarter: { icon: Gem, color: "text-violet-600 bg-violet-500/15 dark:text-violet-400" },
  fiveDealMonth: { icon: Star, color: "text-amber-600 bg-amber-500/15 dark:text-amber-400" },
  hatTrick: { icon: Flame, color: "text-orange-600 bg-orange-500/15 dark:text-orange-400" },
  firstWin: { icon: Sparkles, color: "text-sky-600 bg-sky-500/15 dark:text-sky-400" },
};

export function useHighlights() {
  return useQuery<Highlights>({
    queryKey: ["wins", "highlights"],
    queryFn: () => fetch("/api/wins/highlights").then((r) => r.json()),
    refetchInterval: 60_000,
  });
}

/** Badge icons; hovering shows the badge name and what earned it. With `labels`, names are written out. */
export function BadgeIcons({ badges = [], labels = false, className }: { badges?: Badge[]; labels?: boolean; className?: string }) {
  const t = useTranslations("badges");
  if (!badges.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {badges.map((b, i) => {
        const { icon: Icon, color } = STYLE[b.key];
        const name = t(`${b.key}.name`, { period: b.period ?? "" });
        const tip = `${name}: ${t(`${b.key}.description`)}`;
        return labels ? (
          <span key={i} title={tip} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", color)}>
            <Icon className="size-3" />
            {name}
          </span>
        ) : (
          <span key={i} title={tip} aria-label={tip} role="img" className={cn("inline-flex size-5 items-center justify-center rounded-full", color)}>
            <Icon className="size-3" />
          </span>
        );
      })}
    </span>
  );
}

/** The biggest deal of the week, with its salesman and how many colleagues congratulated them. */
export function WinOfTheWeek() {
  const t = useTranslations("winOfWeek");
  const locale = intlLocale(useLocale());
  const { data, isLoading } = useHighlights();
  if (isLoading) return null;
  const w = data?.winOfTheWeek;

  return (
    <section className="min-w-0 rounded-xl border bg-card p-4 shadow-glass glass-sheen">
      <div className="flex items-center gap-2">
        <Crown className="size-4 text-amber-500" />
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        {w && <span className="ms-auto text-xs text-muted-foreground">{t(w.week === "this" ? "thisWeek" : "lastWeek")}</span>}
      </div>
      {w ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Crown className="size-5 text-amber-500" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold" title={w.client}>{w.client}</p>
            <p className="truncate text-sm text-muted-foreground">
              {w.isOwn ? t("byYou") : t("by", { name: w.producer })}
              {w.premium !== null && <> · <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatAmount(Math.round(w.premium))}</span></>}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(w.securedAt).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })}
              {w.kudos > 0 && ` · ${t("kudos", { count: w.kudos })}`}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t("none")}</p>
      )}
    </section>
  );
}
