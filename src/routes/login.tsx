import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { cn } from "@/lib/utils";

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
  validateSearch: (s: Record<string, unknown>): { redirect?: string; email?: string; mode?: "signin" } => {
    const r = safePath(s["redirect"]);
    const e = typeof s["email"] === "string" ? s["email"].slice(0, 200) : "";
    return { ...(r ? { redirect: r } : {}), ...(e ? { email: e } : {}), ...(s["mode"] === "signin" ? { mode: "signin" as const } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Sign in | Odysstay" },
      { name: "description", content: "Create your Odysstay account or sign in." },
      { property: "og:title", content: "Sign in | Odysstay" },
      { property: "og:description", content: "Create your Odysstay account or sign in." },
    ],
  }),
  component: Login,
});

function Login() {
  const t = useT();
  const navigate = useNavigate();
  const { redirect, email: prefill, mode: startMode } = Route.useSearch();
  const ru = useLang() === "ru";
  const [email, setEmail] = useState(prefill ?? "");
  const [password, setPassword] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [mode, setMode] = useState<"signup" | "signin">(startMode ?? "signup");
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

  // The Google button appears by itself once Google sign-in is switched on in Supabase.
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
    const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setGoogle(!!j?.external?.google)).catch(() => {});
  }, []);
  async function withGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}` },
    });
    if (error) setError(error.message);
  }

  /** Create account first; sign in is one tap away. No email has to arrive (autoconfirm is on). */
  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const mail = email.trim().toLowerCase();
    if (mode === "signin") {
      const r = await supabase.auth.signInWithPassword({ email: mail, password });
      setBusy(false);
      if (r.error) setError(/invalid login credentials/i.test(r.error.message)
        ? (ru ? "Неверный email или пароль. Нет аккаунта? Создайте его выше." : "Wrong email or password. No account yet? Create one above.")
        : r.error.message);
      return;
    }
    if (password.length < 8) { setBusy(false); setError(ru ? "Пароль: не меньше 8 символов." : "Use at least 8 characters for the password."); return; }
    const up = await supabase.auth.signUp({ email: mail, password });
    if (up.error) { setBusy(false); setError(up.error.message); return; }
    if (!up.data.session && (up.data.user?.identities?.length ?? 0) === 0) {
      // This email already has an account: try the password as a sign-in before asking.
      const r = await supabase.auth.signInWithPassword({ email: mail, password });
      setBusy(false);
      if (r.error) { setMode("signin"); setError(ru ? "У этого email уже есть аккаунт. Войдите своим паролем." : "This email already has an account. Sign in with your password."); }
      return;
    }
    setBusy(false);
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
            <div className="mb-6 grid grid-cols-2 rounded-full bg-muted p-1 text-[14px]">
              {(["signup", "signin"] as const).map((m) => (
                <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                  className={cn("h-9 rounded-full transition-colors", mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {m === "signup" ? (ru ? "Регистрация" : "Create account") : (ru ? "Вход" : "Sign in")}
                </button>
              ))}
            </div>
            <h1 className="text-3xl">{mode === "signup" ? (ru ? "Создайте аккаунт" : "Create your account") : (ru ? "С возвращением" : "Welcome back")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{mode === "signup" ? (ru ? "Бесплатно. Email и пароль, без писем и ожидания." : "Free. Email and a password, no confirmation email to wait for.") : (ru ? "Войдите своим email и паролем." : "Sign in with your email and password.")}</p>
            {google && (
              <>
                <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => void withGoogle()}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6c-.3 1.4-1.1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8C3.8 20.6 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2C1.3 8.6.9 10.2.9 12s.4 3.4 1.1 4.9l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.6 1 3.8 3.4 2 7.1l3.7 2.8C6.6 7.4 9.1 5.4 12 5.4z"/></svg>
                  {mode === "signup" ? (ru ? "Регистрация через Google" : "Sign up with Google") : (ru ? "Войти через Google" : "Continue with Google")}
                </Button>
                <p className="my-4 text-center text-xs text-muted-foreground">{ru ? "или" : "or"}</p>
              </>
            )}
            <div className="mt-6 space-y-2">
              <Label htmlFor="email">{t("Email")}</Label>
              <Input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="password">{ru ? "Пароль" : "Password"}</Label>
              <Input id="password" type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? (ru ? "Не меньше 8 символов" : "At least 8 characters") : (ru ? "Ваш пароль" : "Your password")} />
            </div>
            {error && <p className="mt-3 text-sm text-warning">{error}</p>}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? "…" : mode === "signup" ? (ru ? "Создать аккаунт" : "Create account") : (ru ? "Войти" : "Sign in")}
            </Button>
            {mode === "signin" && <button type="button" onClick={() => { setLinkMode(true); setError(null); }} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-brand">
              {ru ? "Забыли пароль? Войти по ссылке на email" : "Forgot it? Sign in with an email link"}
            </button>}
          </form>
          )
        )}
      </div>
    </div>
  );
}
