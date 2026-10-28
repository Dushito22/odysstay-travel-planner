import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ListPlus, MessageCircle, Mic, Send, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { SourceChip } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  askAgent,
  conversationQuery,
  draftMessage,
  STARTER_QUESTIONS,
  stripMarkers,
  type AgentAction,
  type AgentCitation,
  type AgentMessage,
} from "@/lib/agent";
import { appendTask } from "@/lib/deal";
import { cn } from "@/lib/utils";
import { canListen, canSpeak, listen, speak, stopSpeaking, VOICE_LANGS } from "@/lib/voice";

const KIND_LABEL: Record<string, string> = {
  comune_office: "the comune office",
  notary: "a notary",
  surveyor: "a surveyor",
  lawyer: "a lawyer",
  seller: "the seller or sale delegate",
  agency: "the agency",
  contractor: "a contractor",
  translator: "a translator",
  courier: "a courier",
  other: "them",
};

export function AgentChatButton({
  listingId,
  dealId,
  signedIn,
  children,
  className,
  variant = "outline",
}: {
  listingId: string;
  dealId: string | null;
  signedIn: boolean;
  children?: ReactNode;
  className?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() =>
          signedIn
            ? setOpen(true)
            : navigate({ to: "/login", search: { redirect: `/listing/${listingId}` } })
        }
      >
        {children ?? (
          <>
            <MessageCircle /> Ask the agent
          </>
        )}
      </Button>
      {open && (
        <AgentChat listingId={listingId} dealId={dealId} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

export function AgentChat({
  listingId,
  dealId,
  open,
  onOpenChange,
}: {
  listingId: string;
  dealId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const conv = useQuery(conversationQuery(listingId, dealId));
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<string>(() => {
    try { return localStorage.getItem("odys-voice-lang") ?? "en-GB"; } catch { return "en-GB"; }
  });
  const [readAloud, setReadAloud] = useState(false);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const [voiceOk, setVoiceOk] = useState({ listen: false, speak: false });
  useEffect(() => { setVoiceOk({ listen: canListen(), speak: canSpeak() }); }, []);
  useEffect(() => () => { stopRef.current?.(); stopSpeaking(); }, []);

  function pickLang(code: string) {
    setLang(code);
    try { localStorage.setItem("odys-voice-lang", code); } catch { /* private mode */ }
  }

  function talk() {
    if (listening) { stopRef.current?.(); return; }
    stopSpeaking();
    setListening(true);
    setReadAloud(true);
    stopRef.current = listen(lang, setText, (final) => {
      setListening(false);
      if (final.trim()) void send(final);
    }, (err) => { setListening(false); toast.error(err); });
  }

  useEffect(() => {
    if (conv.data) {
      setMessages(conv.data.messages);
      setConvId(conv.data.id);
    }
  }, [conv.data]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  async function send(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    setBusy(true);
    setActions([]);
    setText("");
    const optimistic: AgentMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      citations: [],
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const r = await askAgent({
        conversation_id: convId,
        listing_id: listingId,
        deal_id: dealId,
        message,
      });
      setConvId(r.conversation_id);
      setMessages((m) => [...m, r.message]);
      if (readAloud) speak(stripMarkers(r.message.content), lang);
      setActions(r.actions);
      void qc.invalidateQueries({ queryKey: ["agent-conversation", listingId, dealId] });
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(message);
      toast.error(e instanceof Error ? e.message : "The agent didn't answer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(a: AgentAction) {
    if (!dealId) {
      toast.message("Start a deal first", {
        description:
          "Messages and tasks live in a deal room. Start a deal on this listing, then ask again there.",
      });
      return;
    }
    try {
      if (a.type === "draft_message") {
        await draftMessage({ deal_id: dealId, contact_kind: a.contact_kind, purpose: a.purpose });
        toast.success("Draft ready for your approval in the deal room");
      } else {
        await appendTask(dealId, a.title);
        toast.success("Task added to your plan");
      }
      setActions((list) => list.filter((x) => x !== a));
      void qc.invalidateQueries({ queryKey: ["deal", dealId] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      void qc.invalidateQueries({ queryKey: ["inbox-count"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Please try again.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Your Italy agent
          </SheetTitle>
          <SheetDescription>
            Answers come only from the official notice and Odysstay's verified data.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {conv.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading conversation</p>
          ) : messages.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">
                Ask anything about this property. Try:
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    disabled={busy}
                    className="rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} msg={m} />)
          )}
          {busy && (
            <p className="animate-pulse text-sm text-muted-foreground">Reading the notice</p>
          )}
          {actions.length > 0 && !busy && (
            <div className="flex flex-col gap-2">
              {actions.map((a, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  className="h-auto justify-start whitespace-normal py-2 text-left"
                  onClick={() => runAction(a)}
                >
                  {a.type === "draft_message" ? (
                    <>
                      <Send /> Draft a message to {KIND_LABEL[a.contact_kind] ?? "them"}:{" "}
                      {a.purpose}
                    </>
                  ) : (
                    <>
                      <ListPlus /> Add task: {a.title}
                    </>
                  )}
                </Button>
              ))}
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form
          className="border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          {(voiceOk.listen || voiceOk.speak) && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              {VOICE_LANGS.map((v) => (
                <button key={v.code} type="button" onClick={() => pickLang(v.code)}
                  className={cn("rounded-full px-2.5 py-1", lang === v.code ? "bg-sea text-white" : "glass text-muted-foreground")}>
                  {v.label}
                </button>
              ))}
              {voiceOk.speak && (
                <button type="button" onClick={() => { if (readAloud) stopSpeaking(); setReadAloud(!readAloud); }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-muted-foreground hover:text-brand"
                  aria-pressed={readAloud}>
                  {readAloud ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  {readAloud ? "Reading replies aloud" : "Replies muted"}
                </button>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            {voiceOk.listen && (
              <Button type="button" size="icon" variant={listening ? "default" : "outline"} onClick={talk}
                aria-label={listening ? "Stop listening" : "Talk to the agent"} className={cn(listening && "animate-pulse")}>
                {listening ? <Square /> : <Mic />}
              </Button>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={listening ? "Listening..." : "Ask about this property, or tap the mic and talk"}
              aria-label="Your question"
              className="min-h-0 resize-none"
            />
            <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
              <Send />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Bubble({ msg }: { msg: AgentMessage }) {
  const mine = msg.role === "user";
  return (
    <div className={cn("flex", mine && "justify-end")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          mine ? "bg-sea text-white" : "border bg-card",
        )}
      >
        <p className="whitespace-pre-wrap">{mine ? msg.content : stripMarkers(msg.content)}</p>
        {!mine && msg.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {msg.citations.map((c) => (
              <CitationChip key={`${c.type}-${c.id}`} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({ c }: { c: AgentCitation }) {
  return <SourceChip label={c.label} quote={c.quote} quoteEn={c.quote_en} sourceUrl={c.url} />;
}
