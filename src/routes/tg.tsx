import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * The Telegram Mini App: the two games and the mini site, opened inside Telegram from the bot or the channel.
 * Telegram restricted in-chat widgets to whitelisted bots; a Mini App needs no whitelist. The game screens are
 * the very same markup the widgets used, run here in a frame with a small stand-in for the widget API.
 */
type Mode = "price" | "where" | "app";
type Round = { id: number; kind: "price" | "where"; caption: string; photo: string | null; listing: string };
type TgUser = { id: number; language_code?: string };
type WebApp = {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  openLink: (u: string) => void;
  HapticFeedback?: Record<string, (...a: unknown[]) => void>;
  BackButton?: { show: () => void; hide: () => void; onClick: (f: () => void) => void };
};

export const Route = createFileRoute("/tg")({
  ssr: false,
  head: () => ({ meta: [{ title: "Odysstay" }, { name: "robots", content: "noindex" }], scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }] }),
  component: TgApp,
});

const SITE = "https://odysstay.xyz";
const H: Record<Mode, number> = { price: 284, where: 472, app: 440 };

function webApp(): WebApp | null {
  return (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp ?? null;
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("tg-mini", { body });
  if (error) throw new Error(error.message);
  return data as { html?: string; result?: string; lines?: string[]; rank?: string; error?: string } & Record<string, unknown>;
}

/** Reads what to open: ?m=price|where|app from a bot button, or the start parameter of a t.me/...?startapp= link. */
function startParams(): { mode: Mode; only?: string | undefined; lang: "ru" | "en" } {
  const q = new URLSearchParams(window.location.search);
  const wa = webApp();
  const sp = wa?.initDataUnsafe.start_param ?? q.get("tgWebAppStartParam") ?? "";
  let mode = (q.get("m") as Mode) || "price";
  let only = q.get("only") ?? undefined;
  if (sp) {
    if (sp.startsWith("g_")) { mode = "price"; only = sp.slice(2); }
    else if (sp === "where" || sp === "price" || sp === "app") mode = sp;
  }
  if (!["price", "where", "app"].includes(mode)) mode = "price";
  const lc = q.get("lang") ?? wa?.initDataUnsafe.user?.language_code ?? "ru";
  return { mode, only, lang: lc.startsWith("en") ? "en" : "ru" };
}

function TgApp() {
  const [p, setP] = useState<{ mode: Mode; only?: string | undefined; lang: "ru" | "en" } | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [answered, setAnswered] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [top, setTop] = useState<{ lines: string[]; rank: string } | null>(null);
  const roundRef = useRef<Round | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // After an answer, the extra actions appear inside the game frame: on iPhones taps on the page under
  // the frame did not register, the frame's own buttons always do.
  useEffect(() => {
    if (!answered) return;
    try { frameRef.current?.contentDocument?.getElementById("ox")?.classList.add("on"); } catch { /* frame gone */ }
  }, [answered]);
  roundRef.current = round;
  const dark = typeof window !== "undefined" && webApp()?.colorScheme === "dark";

  // Telegram's script loads with the page; wait for it briefly, then start.
  useEffect(() => {
    let tries = 0;
    const go = () => {
      const wa = webApp();
      if (!wa && tries++ < 20) { window.setTimeout(go, 100); return; }
      wa?.ready(); wa?.expand();
      const sp = startParams();
      if (new URLSearchParams(window.location.search).get("lang") || !wa?.initData) { setP(sp); return; }
      void call({ action: "me", initData: wa.initData }).then((d) => setP({ ...sp, lang: d["lang"] === "en" ? "en" : d["lang"] === "ru" ? "ru" : sp.lang })).catch(() => setP(sp));
    };
    go();
  }, []);

  const ru = p?.lang !== "en";
  const t = (r: string, e: string) => (ru ? r : e);

  const loadRound = useCallback(async (mode: "price" | "where", only?: string) => {
    if (!p) return;
    setErr(null); setAnswered(false); setTop(null);
    try {
      const r = (await call({ action: "round", kind: mode, only, lang: p.lang, initData: webApp()?.initData ?? "" })) as unknown as Round & { error?: string };
      if (r.error) throw new Error(r.error);
      setRound(r);
      setFrameKey((k) => k + 1);
    } catch (e) {
      setErr(String(e).includes("401") || !webApp()?.initData
        ? t("Откройте игру из Telegram: @odysstay_bot", "Open the game from Telegram: @odysstay_bot")
        : t("Не получилось загрузить дом. Попробуйте ещё раз.", "Couldn't load a house. Try again."));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  useEffect(() => {
    if (!p) return;
    void call({ action: "html", mode: p.mode, lang: p.lang }).then((d) => setHtml(String(d.html ?? ""))).catch(() => setErr(t("Не получилось открыть. Попробуйте ещё раз.", "Couldn't open. Try again.")));
    if (p.mode !== "app") void loadRound(p.mode, p.only);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  // The frame's stand-in for TelegramWidget: requests go to our server, links open through Telegram.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w["__odysReq"] = async (data: string) => {
      if (!p) throw new Error("not ready");
      if (p.mode === "app") return { result: String((await call({ action: "site", data, lang: p.lang })).result ?? "") };
      if (data === "n") { await loadRound(p.mode); return { result: "ok" }; }
      const r = roundRef.current;
      if (!r) throw new Error("no round");
      const out = await call({ action: "guess", id: r.id, data, lang: p.lang, initData: webApp()?.initData ?? "" });
      if (!out.result) throw new Error("bad");
      setAnswered(true);
      return { result: String(out.result) };
    };
    // Our own pages open right here in the Mini App: Telegram ignores openLink after a tap inside the frame.
    w["__odysOpen"] = (u: string) => {
      if (u.startsWith(SITE) || u.startsWith("/")) { window.location.assign(u.replace(SITE, "")); return; }
      const wa = webApp(); if (wa) wa.openLink(u); else window.open(u, "_blank");
    };
    w["__odysAct"] = (what: string) => {
      const r = roundRef.current;
      if (what === "open" && r) (w["__odysOpen"] as (u: string) => void)(`${SITE}/listing/${r.listing}?utm_source=tg_game`);
      if (what === "other" && p && p.mode !== "app") { setP({ ...p, mode: p.mode === "price" ? "where" : "price", only: undefined }); setRound(null); setHtml(null); }
      if (what === "top") void showTopRef.current();
    };
  }, [p, loadRound]);

  const srcDoc = html
    ? `<!doctype html><html${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>
var P=window.parent,WA=P.Telegram&&P.Telegram.WebApp;
window.TelegramWidget={colorScheme:${JSON.stringify(dark ? "dark" : "light")},chatData:null,
HapticFeedback:(WA&&WA.HapticFeedback)||{impactOccurred:function(){},notificationOccurred:function(){},selectionChanged:function(){}},
request:function(d){return P.__odysReq(d)},openLink:function(u){P.__odysOpen(u)}};
</script><style>#ox{display:none;gap:8px;padding:6px 2px 4px}#ox.on{display:grid}#ox button:active{transform:scale(.97);opacity:.7}#ox button{transition:transform .1s,opacity .15s;height:44px;border-radius:22px;border:0;font:600 15px -apple-system,system-ui,sans-serif;width:100%;background:${dark ? "#1d2730" : "#f3efe6"};color:${dark ? "#f2ede3" : "#1b1916"}}#ox button.q{background:transparent;color:${dark ? "#8f8a80" : "#8a857b"};height:36px}</style></head><body>${html}${p?.mode !== "app" ? `<div id=ox><button onclick="this.style.opacity=.55;this.textContent='${ru ? "Открываем…" : "Opening…"}';P.__odysAct('open')">${ru ? "Посмотреть этот дом" : "See this house"}</button><button onclick="this.style.opacity=.55;P.__odysAct('other')">${p?.mode === "price" ? (ru ? "Играть: где этот дом?" : "Play: where is this house?") : (ru ? "Играть: угадать цену" : "Play: guess the price")}</button><button class=q onclick="P.__odysAct('top')">${ru ? "Таблица лидеров" : "Leaderboard"}</button></div>` : ""}</body></html>`
    : "";

  const showTopRef = useRef<() => Promise<void>>(async () => {});
  showTopRef.current = showTop;
  async function showTop() {
    try { const d = await call({ action: "top", lang: p?.lang, initData: webApp()?.initData ?? "" }); setTop({ lines: (d.lines as string[]) ?? [], rank: String(d.rank ?? "") }); }
    catch { setTop({ lines: [], rank: "" }); }
  }

  const bg = dark ? "#12181f" : "#ffffff", ink = dark ? "#f2ede3" : "#1b1916", mut = dark ? "#8f8a80" : "#8a857b", soft = dark ? "#1d2730" : "#f3efe6";
  const btn = { height: 44, borderRadius: 22, border: 0, font: "600 15px -apple-system,system-ui,sans-serif", width: "100%" } as const;

  if (!p) return <div style={{ minHeight: "100vh", background: bg }} />;
  const other = p.mode === "price" ? "where" : "price";

  return (
    <main style={{ minHeight: "100vh", background: bg, color: ink, font: "15px -apple-system,system-ui,sans-serif", padding: "14px 14px 28px" }}>
      <div style={{ maxWidth: 380, margin: "0 auto" }}>
        {p.mode !== "app" && round && (
          <>
            {round.photo && <img src={round.photo} alt="" referrerPolicy="no-referrer" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 14, display: "block" }} />}
            <p style={{ margin: "10px 2px 6px", color: mut, fontSize: 14 }}>{round.caption}</p>
          </>
        )}
        {err && <p style={{ textAlign: "center", padding: "40px 10px", color: mut }}>{err}</p>}
        {html && (p.mode === "app" || round) && (
          <iframe ref={frameRef} key={frameKey} title="Odysstay" srcDoc={srcDoc} style={{ width: "100%", height: H[p.mode] + (answered ? 156 : 0), border: 0, display: "block" }} />
        )}
        {top && (
          <div style={{ marginTop: 10, padding: 14, borderRadius: 14, background: soft }}>
            <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{t("Лучшие игроки", "Top players")}</p>
            {top.lines.length ? top.lines.map((l) => <p key={l} style={{ margin: "2px 0" }}>{l}</p>) : <p style={{ margin: 0, color: mut }}>{t("Пока никого. Станьте первым.", "Nobody yet. Be the first.")}</p>}
            {top.rank && <p style={{ margin: "6px 0 0", color: mut }}>{top.rank}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
