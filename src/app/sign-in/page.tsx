"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const schema = z.object({ email: z.string().min(1), password: z.string().min(1) });

export default function SignInPage() {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(schema) });
  const failure = form.formState.errors.root?.message;

  const submit = form.handleSubmit(async (values) => {
    const { error } = await authClient.signIn.email(values);
    if (error) {
      const msg =
        error.status === 429
          ? "Too many attempts. Please wait and try again."
          : "Invalid email or password.";
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
          <p className="text-lg text-sidebar-muted">AP Plus Insurance Brokerage System</p>
        </div>
      </div>
      <div className="flex flex-col">
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
              <h1 className="text-2xl font-semibold">Sign in</h1>
              <p className="text-muted-foreground">Enter your credentials to continue.</p>
            </div>
            {failure && (
              <Alert variant="destructive">
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" required {...form.register("password")} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
