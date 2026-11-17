"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setLocale } from "@/i18n/actions";

/**
 * Switches between English and Arabic. Compact by default (shows "ع" or "EN");
 * with `labelled`, shows the language name beside an icon.
 */
export function LanguageToggle({ labelled = false }: { labelled?: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const target = locale === "ar" ? "English" : "العربية";

  const toggle = () =>
    startTransition(async () => {
      await setLocale(locale === "ar" ? "en" : "ar");
      router.refresh();
    });

  return labelled ? (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending}>
      <Languages />
      {target}
    </Button>
  ) : (
    <Button variant="ghost" size="icon" onClick={toggle} disabled={pending} aria-label={target} title={target} className="text-sm font-semibold">
      {locale === "ar" ? "EN" : "ع"}
    </Button>
  );
}
