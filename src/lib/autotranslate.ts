import { supabase } from "@/integrations/supabase/client";
import { RU } from "./tr";

/**
 * Whole-site Russian. Pages are written in English. While the site language is Russian, any English text that
 * shows up on screen is swapped for a Russian translation: from the built-in dictionary first, then from a
 * browser cache, then from the translate-ui function, which translates each distinct string once for everyone.
 * Until a translation arrives the English stays, so nothing is ever blank. Switching back restores the English.
 */
const CACHE_KEY = "odys-tr-ru-v1";
const BRAND = /^(odysstay|argos|pro|en|ru|sprezzatura|email|pec|pdf|ok)$/i;
const SKIP = '[data-notranslate],[lang="it"],.leaflet-container,script,style,noscript,textarea,input,code,pre,svg';
const BATCH = 40;

const cache = new Map<string, string>();
try {
  const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
  for (const [k, v] of Object.entries(raw)) cache.set(k, v);
} catch { /* no storage */ }
let saveTimer: number | undefined;
function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const entries = [...cache.entries()].slice(-2500);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* full or blocked */ }
  }, 800);
}

const original = new Map<Text, string>(); // node to the English data it had before we touched it
const applied = new Map<Text, string>(); // node to the Russian data we wrote
const waiting = new Map<string, Set<Text>>(); // English text to the nodes waiting for it
const failedAt = new Map<string, number>();
let pending = new Set<string>();
let timer: number | undefined;
let observer: MutationObserver | null = null;
let busy = false;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function wants(t: string) {
  if (t.length < 2 || t.length > 800) return false;
  if (BRAND.test(t) || /@|https?:\/\//.test(t)) return false;
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  const cyr = (t.match(/[А-Яа-яЁё]/g) ?? []).length;
  return latin >= 2 && cyr <= latin && /[A-Za-z]{2,}/.test(t);
}

function put(node: Text, key: string, dst: string) {
  if (!node.isConnected) return;
  const cur = node.data;
  if (norm(cur) !== key) return; // React changed it meanwhile
  const lead = cur.match(/^\s*/)![0];
  const trail = cur.match(/\s*$/)![0];
  const next = lead + dst + trail;
  original.set(node, cur);
  applied.set(node, next);
  node.data = next;
}

function visit(node: Text) {
  if (applied.get(node) === node.data) return; // our own write
  const el = node.parentElement;
  if (!el || el.closest(SKIP)) return;
  const key = norm(node.data);
  if (!wants(key)) return;
  const hit = RU[key] ?? cache.get(key);
  if (hit) { put(node, key, hit); return; }
  const failed = failedAt.get(key);
  if (failed && Date.now() - failed < 60_000) return;
  let set = waiting.get(key);
  if (!set) waiting.set(key, (set = new Set()));
  set.add(node);
  pending.add(key);
  schedule();
}

function scan(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { visit(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) visit(n as Text);
  if (root.nodeType === Node.ELEMENT_NODE) {
    (root as Element).querySelectorAll("input[placeholder],textarea[placeholder]").forEach((e) => {
      const ph = (e as HTMLInputElement).placeholder;
      const key = norm(ph);
      const hit = RU[key] ?? cache.get(key);
      if (hit && wants(key) && !e.hasAttribute("data-ph-en")) { e.setAttribute("data-ph-en", ph); (e as HTMLInputElement).placeholder = hit; }
    });
  }
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 180);
}

async function flush() {
  if (busy) { schedule(); return; }
  const keys = [...pending];
  pending = new Set();
  if (!keys.length) return;
  busy = true;
  try {
    for (let i = 0; i < keys.length; i += BATCH) {
      const chunk = keys.slice(i, i + BATCH);
      const { data, error } = await supabase.functions.invoke("translate-ui", { body: { lang: "ru", texts: chunk } });
      const tr = (!error && (data as { translations?: Record<string, string> } | null)?.translations) || {};
      for (const k of chunk) {
        const d = tr[k];
        if (d) {
          cache.set(k, d);
          waiting.get(k)?.forEach((n) => put(n, k, d));
          waiting.delete(k);
        } else {
          failedAt.set(k, Date.now());
          waiting.delete(k);
        }
      }
      persist();
    }
  } catch {
    keys.forEach((k) => { failedAt.set(k, Date.now()); waiting.delete(k); });
  } finally {
    busy = false;
  }
}

function skipPage() {
  const p = window.location.pathname;
  return p === "/" || p.startsWith("/argos"); // these pages carry their own Russian copy
}

export function startAutoTranslate() {
  if (observer || typeof document === "undefined") return;
  const run = (n: Node) => { if (!skipPage()) scan(n); };
  run(document.body);
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") run(r.target);
      else r.addedNodes.forEach(run);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function stopAutoTranslate() {
  observer?.disconnect();
  observer = null;
  window.clearTimeout(timer);
  pending = new Set();
  waiting.clear();
  for (const [n, en] of original) if (n.isConnected && applied.get(n) === n.data) n.data = en;
  original.clear();
  applied.clear();
  document.querySelectorAll("[data-ph-en]").forEach((e) => {
    (e as HTMLInputElement).placeholder = e.getAttribute("data-ph-en") ?? "";
    e.removeAttribute("data-ph-en");
  });
}
