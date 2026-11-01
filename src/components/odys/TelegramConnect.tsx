import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { callFunction } from "@/lib/agent";
import { useLang } from "@/lib/i18n";

type Status = { connected: boolean; username: string | null; recent: { role: string; content: string; created_at: string }[] };

export const telegramStatusQuery = {
  queryKey: ["telegram-status"],
  queryFn: () => callFunction<Status>("telegram-link", { action: "status" }),
  staleTime: 30_000,
};

/** Opens Telegram with a one-time code; the bot links the chat to this account when it arrives. */
export function useConnectTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Open the tab first, inside the click, so browsers don't block it; point it at Telegram once the code is ready.
      const w = window.open("", "_blank");
      try {
        const { url } = await callFunction<{ url: string }>("telegram-link", { action: "start" });
        if (w) w.location.href = url; else window.location.href = url;
      } catch (e) {
        w?.close();
        throw e;
      }
    },
    onSuccess: () => setTimeout(() => void qc.invalidateQueries({ queryKey: ["telegram-status"] }), 8000),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start"),
  });
}

/** Profile section: connect, see it's connected, see the latest Telegram messages, disconnect. */
export function TelegramConnect() {
  const ru = useLang() === "ru";
  const qc = useQueryClient();
  const status = useQuery({ ...telegramStatusQuery, refetchInterval: (q) => (q.state.data?.connected ? false : 10_000) });
  const connect = useConnectTelegram();
  const unlink = useMutation({
    mutationFn: () => callFunction<Status>("telegram-link", { action: "unlink" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram-status"] }),
  });
  const s = status.data;

  if (!s?.connected) {
    return (
      <div>
        <p className="max-w-xl text-muted-foreground">
          {ru
            ? "Пишите или присылайте голосовые Argos в Telegram. После подключения он знает ваш бюджет и регионы, а весь разговор сохраняется в вашем аккаунте."
            : "Write to Argos or send him voice notes on Telegram. Once connected he knows your budget and regions, and the whole conversation is saved to your account."}
        </p>
        <Button className="mt-4" onClick={() => connect.mutate()} disabled={connect.isPending}>
          <Send className="h-4 w-4" /> {ru ? "Подключить Telegram" : "Connect Telegram"}
        </Button>
        {connect.isSuccess && (
          <p className="mt-2 text-sm text-muted-foreground">{ru ? "В Telegram нажмите «Старт». Эта страница обновится сама." : "In Telegram, press Start. This page updates by itself."}</p>
        )}
      </div>
    );
  }
  return (
    <div>
      <p>
        {ru ? "Подключено" : "Connected"}{s.username ? <> {ru ? "как" : "as"} <strong>@{s.username}</strong></> : null}.{" "}
        <a href="https://t.me/odysstay_bot" target="_blank" rel="noreferrer" className="text-azure hover:underline">{ru ? "Открыть чат" : "Open the chat"}</a>
      </p>
      {s.recent.length > 0 && (
        <div className="mt-4 space-y-2 rounded-2xl bg-muted/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ru ? "Последние сообщения в Telegram" : "Latest on Telegram"}</p>
          {s.recent.map((m, i) => (
            <p key={i} className="text-sm leading-relaxed">
              <span className={m.role === "user" ? "font-medium" : "font-display italic text-azure"}>{m.role === "user" ? (ru ? "Вы" : "You") : "Argos"}: </span>
              {m.content}
            </p>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
        {ru ? "Отключить" : "Disconnect"}
      </Button>
    </div>
  );
}
