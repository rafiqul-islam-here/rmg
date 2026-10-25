"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Building, CircleQuestionMark, Clock, Eye, EyeOff, Globe, Lock, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/tf/drawer";
import { ErrorState, OfflineBanner } from "@/components/tf/states";
import { api } from "@/lib/api/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { homePathFor } from "@/lib/permissions";
import { COMPANY_COOKIE } from "@/lib/session";
import { cn } from "@/lib/utils";

/** "Remember this device" also remembers the company name for the next sign-in. */
function rememberCompany(name: string | null) {
  document.cookie = name
    ? `${COMPANY_COOKIE}=${encodeURIComponent(name)}; path=/; max-age=31536000; samesite=lax`
    : `${COMPANY_COOKIE}=; path=/; max-age=0`;
}

export interface DemoLogin {
  company: string;
  password: string;
  accounts: { username: string; role: string; lands: string }[];
}

/** Centered 400px card on the light background (UI guideline §6.1). Company → Username or ID → Password. */
export function LoginForm({ demo, initialCompany = "" }: { demo?: DemoLogin; initialCompany?: string }) {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [company, setCompany] = useState(initialCompany);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ company?: string; login?: string; password?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(body: { company: string; login: string; password: string }, key: string) {
    setFormError(undefined);
    setBusy(key);
    try {
      const user = await api.login({ ...body, remember });
      rememberCompany(remember ? user.companyName : null);
      router.replace(homePathFor(user));
      router.refresh();
    } catch (err) {
      // Keep what the user typed.
      setFormError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      company: company.trim() ? undefined : "Enter your company name.",
      login: login.trim() ? undefined : "Enter your username or ID.",
      password: password ? undefined : "Enter your password.",
    };
    setErrors(next);
    const first = (["company", "login", "password"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    void signIn({ company: company.trim(), login: login.trim(), password }, "form");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <OfflineBanner />
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px] rounded-xl border border-border bg-surface p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Image src="/brand/threadflow-logo.png" alt="ThreadFlow" width={160} height={95} priority className="h-auto w-36" />
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Production. Connected.</p>
          </div>

          <form onSubmit={submit} noValidate className="grid gap-4">
            {formError && <ErrorState error={new Error(formError)} title="Couldn't sign you in." />}

            <Field label="Company name" required htmlFor="company" error={errors.company} helper="The factory or company you work for.">
              {(id) => (
                <div className="relative">
                  <Building className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id={id}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Demo Garments Ltd."
                    autoComplete="organization"
                    aria-invalid={!!errors.company}
                    className="pl-9"
                  />
                </div>
              )}
            </Field>

            <Field label="Username or ID" required htmlFor="login" error={errors.login} helper="Your username (e.g. rahim.mia) or employee ID (e.g. EMP-0013).">
              {(id) => (
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id={id}
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="rahim.mia or EMP-0013"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={!!errors.login}
                    className="pl-9"
                  />
                </div>
              )}
            </Field>

            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="password" className="text-[13px] font-medium text-ink">
                  Password <span className="text-danger" aria-hidden>*</span>
                </Label>
                <button
                  type="button"
                  className="text-[13px] font-medium text-primary hover:underline"
                  onClick={() => toast.info("Ask your factory admin to reset your password.", { description: "Floor help: Ext. 204" })}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  className="pr-11 pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-ink"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-st-blocked" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
                Remember this device
              </label>
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Clock className="size-4" aria-hidden /> Shift A (Day)
              </span>
            </div>

            {demo && (
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Users className="size-4" aria-hidden /> Quick demo sign-in
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Company <b className="text-ink">{demo.company}</b> · password <b className="tabular text-ink">{demo.password}</b>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {demo.accounts.map((d) => (
                    <button
                      key={d.username}
                      type="button"
                      onClick={() => {
                        // Fills the real fields and signs in the normal way.
                        setCompany(demo.company);
                        setLogin(d.username);
                        setPassword(demo.password);
                        void signIn({ company: demo.company, login: d.username, password: demo.password }, d.username);
                      }}
                      disabled={!!busy}
                      className="flex min-h-14 flex-col items-center justify-center rounded-md border border-border bg-surface px-1 text-center hover:border-primary/50 disabled:opacity-50"
                    >
                      <span className="text-sm font-semibold text-ink">{busy === d.username ? "Signing in…" : d.role}</span>
                      <span className="text-xs text-muted-foreground">{d.lands}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={busy === "form"} disabled={!!busy && busy !== "form"}>
              {t("Sign in")} <ArrowRight />
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CircleQuestionMark className="size-4" aria-hidden /> Floor help: <b className="text-ink">Ext. 204</b>
            </span>
            <span>Garments Ops v1</span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 border-t border-dashed border-border pt-4 text-[13px]" role="group" aria-label="Language">
            <Globe className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Language:</span>
            {(
              [
                { value: "en", label: "English" },
                { value: "bn", label: "বাংলা (Bangla)" },
              ] as { value: Lang; label: string }[]
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setLang(o.value)}
                aria-pressed={lang === o.value}
                className={cn("min-h-9 rounded-md px-2.5 font-medium", lang === o.value ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-ink")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">© 2026 ThreadFlow · Logic Matrix</p>
      </main>
    </div>
  );
}
