import { ArrowUp, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { canListen, listen } from "@/lib/voice";

/** Where the buyer talks to Argos: a mic first, typing second. Used on the hero (over video) and in agent mode. */
export function ArgosComposer({
  onSubmit,
  busy = false,
  tone = "dark",
  placeholder = "A stone house in Puglia under €40k, near a bar, some work is fine…",
  autoFocus = false,
  lang = "en-GB",
}: {
  onSubmit: (text: string, spoken: boolean) => void;
  busy?: boolean;
  tone?: "dark" | "light";
  placeholder?: string;
  autoFocus?: boolean;
  lang?: string;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setMicOk(canListen()); }, []);
  useEffect(() => () => stop.current?.(), []);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function send(value = text, spoken = false) {
    const v = value.trim();
    if (!v || busy) return;
    onSubmit(v, spoken);
    setText("");
  }

  function mic() {
    if (listening) {
      stop.current?.();
      return;
    }
    setListening(true);
    stop.current = listen(lang, setText, (final) => {
      setListening(false);
      if (final.trim()) send(final, true);
    }, (err) => {
      setListening(false);
      toast.error(err);
    });
  }

  const dark = tone === "dark";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn(
        "flex w-full items-end gap-2 rounded-[28px] p-2 transition-shadow",
        dark ? "frost text-white" : "border bg-card shadow-sm focus-within:shadow-hover",
      )}
    >
      {micOk && (
        <button
          type="button"
          onClick={mic}
          aria-label={listening ? "Stop listening" : "Talk to Argos"}
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
            listening
              ? "bg-terra text-white"
              : dark ? "bg-white/15 hover:bg-white/25" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-terra/60" aria-hidden />}
          {listening ? <Square className="relative h-4 w-4" /> : <Mic className="h-5 w-5" />}
        </button>
      )}
      <textarea
        ref={area}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        maxLength={1000}
        aria-label="Tell Argos what you are looking for"
        placeholder={listening ? "Listening… just talk" : placeholder}
        className={cn(
          "min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-base leading-6 outline-none md:text-lg",
          dark ? "placeholder:text-white/60" : "placeholder:text-muted-foreground",
        )}
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        aria-label="Send"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40",
          dark ? "bg-white text-foreground" : "bg-foreground text-background",
        )}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </form>
  );
}
