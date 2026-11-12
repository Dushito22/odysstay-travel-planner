import { BadgeCheck, Copy, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveMessage,
  NeedsEmail,
  markMessageSent,
  rejectMessage,
  saveMessageBody,
  type DealMessage,
  type DealThread,
} from "@/lib/deal";
import { cn } from "@/lib/utils";
import { ConfirmBinding } from "./ConfirmBinding";

type Run = (key: string, fn: () => Promise<unknown>, success?: string) => Promise<boolean>;

/** English by default, with a toggle to the original text that was or will be sent. */
export function Bilingual({ msg }: { msg: DealMessage }) {
  const hasEn = !!msg.body_en && msg.body_en !== msg.body_original;
  const [orig, setOrig] = useState(!hasEn);
  return (
    <div>
      {hasEn && (
        <div className="mb-2 inline-flex rounded-full border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setOrig(false)}
            className={cn("rounded-full px-2.5 py-0.5", !orig && "bg-sea text-white")}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setOrig(true)}
            className={cn("rounded-full px-2.5 py-0.5", orig && "bg-sea text-white")}
          >
            Original
            {msg.language && msg.language !== "en" ? ` (${msg.language.toUpperCase()})` : ""}
          </button>
        </div>
      )}
      <p
        lang={orig ? (msg.language ?? undefined) : "en"}
        className="whitespace-pre-wrap text-sm leading-relaxed"
      >
        {orig ? msg.body_original : msg.body_en}
      </p>
    </div>
  );
}

export function Recipient({ thread }: { thread: DealThread | undefined }) {
  const c = thread?.contacts;
  if (!c) return <span className="text-muted-foreground">Recipient not chosen yet</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{c.name}</span>
      {c.organisation && <span className="text-muted-foreground">· {c.organisation}</span>}
      {c.register_verified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
          <BadgeCheck className="h-3 w-3" /> Registered
          {c.register_name ? `: ${c.register_name}` : ""}
        </span>
      )}
    </span>
  );
}

/** A message waiting for the user's decision. Binding messages need CONFIRM. */
export function ApprovalCard({
  msg,
  thread,
  userId,
  run,
  pending,
}: {
  msg: DealMessage;
  thread: DealThread | undefined;
  userId: string;
  run: Run;
  pending: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.body_original);
  const busy = pending?.startsWith(msg.id) ?? false;

  const noAddr = !!thread?.contacts && !thread.contacts.email && !thread.contacts.pec;
  const [needEmail, setNeedEmail] = useState(noAddr);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [typedSaved, setTypedSaved] = useState("");
  const approve = (typed = "", to?: string) =>
    run(
      `${msg.id}-approve`,
      async () => {
        try {
          await approveMessage(msg, userId, typed, to);
        } catch (e) {
          if (e instanceof NeedsEmail) { setTypedSaved(typed); setNeedEmail(true); throw new Error("Add the recipient's email to send it."); }
          throw e;
        }
      },
      "Sent. Replies will appear here, on Telegram and in your email.",
    );

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-5",
        msg.is_binding && "border-warning ring-1 ring-warning/40",
      )}
    >
      {msg.is_binding && (
        <p className="mb-3 inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
          Binding: this commits you
        </p>
      )}
      <div className="text-sm">
        <span className="text-muted-foreground">To </span>
        <Recipient thread={thread} />
      </div>
      {msg.subject && <p className="mt-1 font-medium">{msg.subject}</p>}
      {thread?.purpose_en && (
        <p className="mt-0.5 text-xs text-muted-foreground">Purpose: {thread.purpose_en}</p>
      )}

      <div className="mt-4">
        {editing ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Edit the original text. The English is a translation for you and is not sent.
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              lang={msg.language ?? undefined}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !draft.trim()}
                onClick={async () => {
                  const ok = await run(
                    `${msg.id}-save`,
                    () => saveMessageBody(msg.id, draft),
                    "Saved",
                  );
                  if (ok) setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(msg.body_original);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Bilingual msg={msg} />
        )}
      </div>

      {needEmail && (
        <div className="mt-4 rounded-xl border border-dashed p-4">
          <p className="text-[15px] font-medium">No email for this seller yet</p>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            Argos already tried the listing and a web search. Add the address if you have it and Argos sends this. Or send the Italian text yourself through the portal's contact form.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@agency.it"
              className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-[15px] outline-none focus:border-foreground/40" />
            <Button size="sm" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => approve(typedSaved, email)}>Send</Button>
            <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${msg.subject ? msg.subject + "\n\n" : ""}${msg.body_original}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
              {copied ? "Copied" : "Copy the Italian text"}
            </Button>
          </div>
        </div>
      )}

      {!editing && (!needEmail || noAddr) && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {noAddr ? null : msg.is_binding ? (
            <ConfirmBinding
              trigger={<Button disabled={busy}>Approve</Button>}
              title="Approve a binding message?"
              description={
                <>
                  <p>
                    This message commits you, for example to an offer, a payment or accepting a
                    quote.
                  </p>
                  <p>
                    Read the original text carefully. If you are unsure, check with a notary or
                    lawyer first.
                  </p>
                </>
              }
              actionLabel="Approve and commit"
              onConfirm={(typed) => approve(typed)}
            />
          ) : (
            <Button disabled={busy} onClick={() => approve()}>
              Approve and send
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(`${msg.id}-reject`, () => rejectMessage(msg), "Rejected")}
          >
            Reject
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
        </div>
      )}
    </article>
  );
}

/** A message approved before automatic sending existed: send it now, or copy it and send it yourself. */
export function SendYourself({
  msg,
  thread,
  run,
  pending,
}: {
  msg: DealMessage;
  thread: DealThread | undefined;
  run: Run;
  pending: string | null;
}) {
  const to = thread?.contacts?.email ?? thread?.contacts?.pec ?? null;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Copy failed. Select the text manually.");
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-dashed p-3 text-sm">
      <p className="text-muted-foreground">
        Approved but not sent yet. Argos can send it now, or you can send it yourself.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending === `${msg.id}-send`}
          onClick={() => run(`${msg.id}-send`, () => approveMessage(msg, "", "CONFIRM"), "Sent")}
        >
          Send now
        </Button>
        {to ? (
          <Button size="sm" variant="outline" onClick={() => copy(to, "Address")}>
            <Copy /> {to}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No recipient address on file yet.</span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            copy([msg.subject, msg.body_original].filter(Boolean).join("\n\n"), "Message")
          }
        >
          <Copy /> Copy subject and text
        </Button>
        <Button
          size="sm"
          disabled={pending === `${msg.id}-sent`}
          onClick={() => run(`${msg.id}-sent`, () => markMessageSent(msg), "Marked as sent")}
        >
          Mark as sent
        </Button>
      </div>
    </div>
  );
}
