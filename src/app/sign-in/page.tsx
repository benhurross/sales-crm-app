"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Languages, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setLocale } from "@/i18n/actions";
import { authClient } from "@/lib/auth-client";

const schema = z.object({ email: z.string().min(1), password: z.string().min(1) });

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations("signIn");
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(schema) });
  const failure = form.formState.errors.root?.message;

  const submit = form.handleSubmit(async (values) => {
    const { error } = await authClient.signIn.email(values);
    if (error) {
      const msg =
        error.status === 429
          ? t("tooManyAttempts")
          : t("invalidCredentials");
      form.setError("root", { message: msg });
      return;
    }
    router.replace("/");
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Image src="/brand/applus-white.svg" alt="AP Plus" width={193} height={60} />
        <div className="space-y-3">
          <p className="text-3xl font-semibold text-white">Sales CRM</p>
          <p className="text-lg text-sidebar-muted">{t("tagline")}</p>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(async () => {
                await setLocale(locale === "ar" ? "en" : "ar");
                router.refresh();
              })
            }
          >
            <Languages />
            {locale === "ar" ? "English" : "العربية"}
          </Button>
        </div>
        <main className="flex flex-1 items-center justify-center p-6">
          <form onSubmit={submit} className="w-full max-w-sm space-y-6">
            <div className="space-y-2">
              <Image
                src="/brand/applus-logo.svg"
                alt="AP Plus"
                width={155}
                height={48}
                className="mb-6 dark:hidden lg:hidden"
              />
              <h1 className="text-2xl font-semibold">{t("title")}</h1>
              <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>
            {failure && (
              <Alert variant="destructive">
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" autoComplete="email" required {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" autoComplete="current-password" required {...form.register("password")} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {t("title")}
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
