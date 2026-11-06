import { useSyncExternalStore } from "react";

/** Site language for the public pages and Argos: English or Russian. Remembered per browser. */
export type Lang = "en" | "ru";
const KEY = "odys-lang";
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // private mode: the choice lasts for this page only
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    read,
    () => "en",
  );
}

/** Speech language for the mic and Argos's voice. */
export const speechLang = (l: Lang) => (l === "ru" ? "ru-RU" : "en-GB");

/** The buyer picked a language: switch the site now and, when signed in, remember it on the account
 * so Argos, calls, Telegram and the weekly picks all follow. */
export function chooseLang(l: Lang) {
  setLang(l);
  void import("@/integrations/supabase/client").then(async ({ supabase }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("profiles").update({ language: l }).eq("id", data.user.id);
  }).catch(() => {});
}
