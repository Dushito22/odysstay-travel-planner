// Deno runtime helpers shared by the edge functions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(...names: string[]): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new HttpError(500, `Server is missing ${names[0]}`);
}

/**
 * The server-side key. Prefers the new secret keys (SUPABASE_SECRET_KEYS, a JSON object of name to key)
 * and falls back to the legacy service role key while it still exists.
 */
function secretKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>;
      const key = keys["default"] ?? Object.values(keys)[0];
      if (key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  return env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

/** Admin client. Every query made with it must check ownership explicitly. */
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in to use this.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Sign in again.");
  return data.user;
}

/** Wraps a handler with CORS, JSON parsing and readable errors. */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return await handler(req, body);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something went wrong on our side. Please try again." }, 500);
    }
  });
}

export function str(v: unknown, name: string, { required = true, max = 2000 } = {}): string {
  if (typeof v !== "string" || !v.trim()) {
    if (required) throw new HttpError(400, `Missing ${name}`);
    return "";
  }
  if (v.length > max) throw new HttpError(400, `${name} is too long`);
  return v.trim();
}

export function uuid(v: unknown, name: string, required = true): string | null {
  if (v == null || v === "") {
    if (required) throw new HttpError(400, `Missing ${name}`);
    return null;
  }
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v))
    throw new HttpError(400, `Invalid ${name}`);
  return v;
}

export async function callClaude(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 1500,
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    console.error("anthropic", res.status, await res.text());
    throw new HttpError(502, "The agent is unavailable right now. Please try again in a minute.");
  }
  const data = await res.json();
  return ((data.content ?? []) as { type: string; text?: string }[])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/** Load a listing and everything verified about it, using the admin client. Listings are public data. */
export async function loadListing(admin: SupabaseClient, listingId: string) {
  const [l, f, r, g, e] = await Promise.all([
    admin.from("listing_feed").select("*").eq("id", listingId).maybeSingle(),
    admin.from("listing_facts").select("*").eq("listing_id", listingId),
    admin.from("listing_red_flags").select("*").eq("listing_id", listingId),
    admin.from("listing_grants").select("fit, reason_en, grants(*)").eq("listing_id", listingId),
    admin.from("cost_estimates").select("*").eq("listing_id", listingId).is("user_id", null),
  ]);
  if (l.error) throw l.error;
  if (!l.data) throw new HttpError(404, "Listing not found");
  const sev: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return {
    listing: l.data,
    facts: f.data ?? [],
    flags: (r.data ?? []).sort((a, b) => (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3)),
    grants: (g.data ?? [])
      .filter((x) => x.grants)
      .map((x) => ({
        ...(x.grants as unknown as Record<string, unknown>),
        fit: x.fit,
        reason_en: x.reason_en,
      })),
    estimates: e.data ?? [],
  };
}
