import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Wordmark } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

function safePath(p: unknown): string | null {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => {
    const r = safePath(s["redirect"]);
    return r ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in | Odysstay" },
      { name: "description", content: "Sign in to Odysstay with a one-time email link." },
      { property: "og:title", content: "Sign in | Odysstay" },
      { property: "og:description", content: "Sign in to Odysstay with a one-time email link." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
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
      <Link to="/" className="mb-8"><Wordmark /></Link>
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-hover">
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto h-10 w-10 text-success" />
            <h1 className="mt-4 text-3xl">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. Open it on this device.
            </p>
            <button onClick={() => setSent(false)} className="mt-6 text-sm text-brand hover:underline">
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-3xl">Sign in to Odysstay</h1>
            <div className="mt-6 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {error && <p className="mt-3 text-sm text-warning">{error}</p>}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? "Sending" : "Email me a link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
