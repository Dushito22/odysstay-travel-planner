// Pulls ImmobilScan's open auction statistics (CC BY 4.0) into auction_benchmarks. Weekly, via
// .github/workflows/benchmarks.yml. We credit them wherever a figure is shown.
import { adminClient, corsHeaders } from "../_shared/runtime.ts";

const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const CSV = "https://immobilscan.it/en/property-auction-statistics.csv";

function parse(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const head = lines.shift()!.split(",");
  return lines.map((l) => {
    // Values have no quoted commas except the trailing source text, so split up to the header length.
    const parts = l.split(",");
    const row: Record<string, string> = {};
    head.forEach((h, i) => { row[h] = i === head.length - 1 ? parts.slice(i).join(",") : parts[i] ?? ""; });
    return row;
  });
}
const n = (v: string) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SECRET || req.headers.get("x-drop-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  const r = await fetch(CSV, { headers: { "user-agent": "Odysstay (benchmarks, credited CC BY 4.0)" } });
  if (!r.ok) return new Response(JSON.stringify({ error: `csv ${r.status}` }), { status: 502 });
  // Some rows repeat a key with a month (a monthly series); keep the current snapshot, the row with no month.
  const seen = new Map<string, Record<string, string>>();
  for (const x of parse(await r.text()).filter((x) => x.level)) {
    const k = `${x.level}|${x.code ?? ""}|${x.category ?? ""}`;
    const prev = seen.get(k);
    if (!prev || (prev.month && !x.month)) seen.set(k, x);
  }
  const rows = [...seen.values()];
  const out = rows.map((x) => ({
    level: x.level, code: x.code ?? "", name: x.name, category: x.category ?? "",
    active_auctions: n(x.active_auctions), new_30d: n(x.new_30d), starting_price_median: n(x.starting_price_median),
    starting_price_mean: n(x.starting_price_mean), minimum_bid_mean: n(x.minimum_bid_mean), average_price_cut_pct: n(x.average_price_cut_pct),
    n_with_price_cut: n(x.n_with_price_cut), updated_at: x.updated_at || null, source: x.source || "ImmobilScan (CC BY 4.0)",
  }));
  const { error } = await adminClient().from("auction_benchmarks").upsert(out, { onConflict: "level,code,category" });
  return new Response(JSON.stringify({ rows: out.length, levels: [...new Set(out.map((o) => o.level))], error: error?.message ?? null }), { headers: { "content-type": "application/json" } });
});
