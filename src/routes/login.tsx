import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { LangToggle } from "@/components/odys/LangToggle";
import { Wordmark } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useT } from "@/lib/tr";

function safePath(p: unknown): string | null {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; email?: string } => {
    const r = safePath(s["redirect"]);
    const e = typeof s["email"] === "string" ? s["email"].slice(0, 200) : "";
    return { ...(r ? { redirect: r } : {}), ...(e ? { email: e } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Sign in | Odysstay" },
      { name: "description", content: "Sign in to Odysstay." },
      { property: "og:title", content: "Sign in | Odysstay" },
      { property: "og:description", content: "Sign in to Odysstay." },
    ],
  }),
  component: Login,
});

function Login() {
  const t = useT();
  const navigate = useNavigate();
  const { redirect, email: prefill } = Route.useSearch();
  const ru = useLang() === "ru";
  const [email, setEmail] = useState(prefill ?? "");
  const [password, setPassword] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const go = () => {
      if (redirect) navigate({ to: redirect as "/", replace: true });
      else navigate({ to: "/discover", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) go();
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  /** One form for both: sign in, or create the account if this email is new. No email has to arrive. */
  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const mail = email.trim().toLowerCase();
    const signIn = await supabase.auth.signInWithPassword({ email: mail, password });
    if (!signIn.error) { setBusy(false); return; }
    if (!/invalid login credentials/i.test(signIn.error.message)) { setBusy(false); setError(signIn.error.message); return; }
    if (password.length < 8) { setBusy(false); setError(ru ? "Пароль: не меньше 8 символов." : "Use at least 8 characters for the password."); return; }
    const up = await supabase.auth.signUp({ email: mail, password });
    setBusy(false);
    if (up.error) { setError(up.error.message); return; }
    // An existing account answers sign-up with no identities: the password was simply wrong.
    if (!up.data.session && (up.data.user?.identities?.length ?? 0) === 0) {
      setError(ru ? "Неверный пароль для этого email. Или войдите по ссылке ниже." : "Wrong password for this email. Or sign in with a link below.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <LangToggle className="absolute right-5 top-5" />
      <Link to="/" className="mb-8"><Wordmark size="lg" /></Link>
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-hover">
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto h-10 w-10 text-success" />
            <h1 className="mt-4 text-3xl">{t("Check your inbox")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. Open it on this device.
            </p>
            <button onClick={() => setSent(false)} className="mt-6 text-sm text-brand hover:underline">
              {t("Use a different email")}
            </button>
          </div>
        ) : (
          linkMode ? (
          <form onSubmit={submit}>
            <h1 className="text-3xl">{ru ? "Вход по ссылке" : "Sign in with a link"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{ru ? "Для тех, кто забыл пароль или вошёл раньше по ссылке." : "If you forgot your password or signed up with a link before."}</p>
            <div className="mt-6 space-y-2">
              <Label htmlFor="email">{t("Email")}</Label>
              <Input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {error && <p className="mt-3 text-sm text-warning">{error}</p>}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? "…" : t("Email me a link")}
            </Button>
            <button type="button" onClick={() => { setLinkMode(false); setError(null); }} className="mt-4 w-full text-center text-sm text-brand hover:underline">
              {ru ? "Назад к паролю" : "Back to password"}
            </button>
          </form>
          ) : (
          <form onSubmit={submitPassword}>
            <h1 className="text-3xl">{t("Sign in to Odysstay")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{ru ? "Новый email? Аккаунт создастся сразу." : "New here? The same form creates your account."}</p>
            <div className="mt-6 space-y-2">
              <Label htmlFor="email">{t("Email")}</Label>
              <Input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="password">{ru ? "Пароль" : "Password"}</Label>
              <Input id="password" type="password" required minLength={6} autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder={ru ? "Не меньше 8 символов" : "At least 8 characters"} />
            </div>
            {error && <p className="mt-3 text-sm text-warning">{error}</p>}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? "…" : ru ? "Продолжить" : "Continue"}
            </Button>
            <button type="button" onClick={() => { setLinkMode(true); setError(null); }} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-brand">
              {ru ? "Забыли пароль? Войти по ссылке на email" : "Forgot it? Sign in with an email link"}
            </button>
          </form>
          )
        )}
      </div>
    </div>
  );
}
