import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Bot,
  CalendarClock,
  Euro,
  ExternalLink,
  FileText,
  ListChecks,
  MapPin,
  MessageSquarePlus,
  PenLine,
  Plus,
  Settings2,
  User,
  Wrench,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Money } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { draftMessage } from "@/lib/agent";
import {
  addNote,
  addTask,
  CONTACT_KINDS,
  isTaskOverdue,
  moveTask,
  parseDealNotes,
  REQUEST_PURPOSES,
  serializeDealNotes,
  setQuoteStatus,
  stageLabel,
  TASK_STATUSES,
  taskStatusLabel,
  toggleDealDocument,
  updateDealSettings,
  updateTask,
  withdrawDeal,
  type DealBundle,
  type DealMessage,
  type DealTask,
  type DealThread,
} from "@/lib/deal";
import { cn } from "@/lib/utils";
import { ConfirmBinding } from "./ConfirmBinding";
import { Bilingual, Recipient, SendYourself } from "./MessageView";

type Run = (key: string, fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
type TabProps = { bundle: DealBundle; run: Run; pending: string | null };

const KIND_ICON: Record<string, typeof ListChecks> = {
  step: ListChecks,
  document: FileText,
  payment: Euro,
  deadline: CalendarClock,
  visit: MapPin,
  signature: PenLine,
};

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
      {children}
    </div>
  );
}

// ---------------- Plan ----------------

export function PlanTab({ bundle, run, pending }: TabProps) {
  const { deal, tasks } = bundle;
  const [title, setTitle] = useState("");
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.sort - b.sort), [tasks]);
  const groups = TASK_STATUSES.map((s) => ({
    ...s,
    items: sorted.filter((t) => t.status === s.value),
  })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.value}>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {g.label} <span className="tnum">({g.items.length})</span>
          </h3>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {g.items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                prev={sorted[sorted.indexOf(t) - 1]}
                next={sorted[sorted.indexOf(t) + 1]}
                run={run}
                pending={pending}
              />
            ))}
          </ul>
        </section>
      ))}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const v = title.trim();
          if (!v) return;
          const ok = await run(
            "add-task",
            () => addTask(deal.id, v, (sorted.at(-1)?.sort ?? 0) + 1),
            "Task added",
          );
          if (ok) setTitle("");
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add your own task"
          aria-label="New task"
        />
        <Button type="submit" disabled={pending === "add-task" || !title.trim()}>
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}

function TaskRow({
  task,
  prev,
  next,
  run,
  pending,
}: {
  task: DealTask;
  prev: DealTask | undefined;
  next: DealTask | undefined;
  run: Run;
  pending: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(task.detail_en ?? "");
  const Icon = KIND_ICON[task.kind] ?? ListChecks;
  const overdue = isTaskOverdue(task);
  const busy = pending?.startsWith(task.id) ?? false;
  const done = task.status === "done" || task.status === "skipped";

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={done ? "Mark as to do" : "Mark as done"}
          disabled={busy}
          onClick={() =>
            run(`${task.id}-status`, () => updateTask(task.id, { status: done ? "todo" : "done" }))
          }
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            task.status === "done" && "border-success bg-success text-background",
          )}
        >
          {task.status === "done" && <BadgeCheck className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className={cn("font-medium", done && "text-muted-foreground line-through")}>
              {task.title_en}
            </span>
            {overdue && (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                Overdue
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {task.due_at && (
              <span className="tnum">Due {format(new Date(task.due_at), "d MMM yyyy")}</span>
            )}
            {task.official_url && (
              <a
                href={task.official_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                Official source <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Close" : task.detail_en ? "Notes and details" : "Add note or due date"}
            </button>
          </div>
          {!open && task.detail_en && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {task.detail_en}
            </p>
          )}
          {open && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={task.status}
                    onValueChange={(v) =>
                      run(`${task.id}-status`, () => updateTask(task.id, { status: v }))
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue>{taskStatusLabel(task.status)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor={`due-${task.id}`}>
                    Due date
                  </Label>
                  <Input
                    id={`due-${task.id}`}
                    type="date"
                    className="w-44"
                    defaultValue={task.due_at ? task.due_at.slice(0, 10) : ""}
                    onBlur={(e) => {
                      const v = e.target.value;
                      const current = task.due_at ? task.due_at.slice(0, 10) : "";
                      if (v !== current)
                        void run(`${task.id}-due`, () =>
                          updateTask(task.id, {
                            due_at: v ? new Date(`${v}T12:00:00`).toISOString() : null,
                          }),
                        );
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`note-${task.id}`}>
                  Notes
                </Label>
                <Textarea
                  id={`note-${task.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(
                    `${task.id}-note`,
                    () => updateTask(task.id, { detail_en: note.trim() || null }),
                    "Saved",
                  )
                }
              >
                Save notes
              </Button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Move up"
            disabled={!prev || busy}
            onClick={() => prev && run(`${task.id}-move`, () => moveTask(task, prev))}
          >
            <ArrowUp />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Move down"
            disabled={!next || busy}
            onClick={() => next && run(`${task.id}-move`, () => moveTask(task, next))}
          >
            <ArrowDown />
          </Button>
        </div>
      </div>
    </li>
  );
}

// ---------------- Conversations ----------------

const THREAD_STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "Open", tone: "bg-muted text-muted-foreground" },
  waiting_reply: { label: "Waiting for reply", tone: "bg-brand-soft text-brand" },
  needs_you: { label: "Needs you", tone: "bg-caution-soft text-caution" },
  closed: { label: "Closed", tone: "bg-muted text-muted-foreground" },
};

const MESSAGE_STATUS: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Waiting for your approval",
  approved: "Approved",
  rejected: "Rejected",
  sending: "Sending",
  sent: "Sent",
  received: "Received",
  failed: "Failed to send",
};

export function ConversationsTab({ bundle, run, pending }: TabProps) {
  const { threads, messages, deal } = bundle;
  const [selected, setSelected] = useState<string | null>(null);
  const thread = threads.find((t) => t.id === selected);

  if (thread) {
    return (
      <ThreadView
        thread={thread}
        messages={messages.filter((m) => m.thread_id === thread.id)}
        onBack={() => setSelected(null)}
        run={run}
        pending={pending}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewRequest
          dealId={deal.id}
          run={run}
          pending={pending}
          onCreated={(id) => setSelected(id)}
        />
      </div>
      {!threads.length ? (
        <Empty>No conversations yet. Start a request to the comune, a notary or a surveyor.</Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {threads.map((t) => {
            const st = THREAD_STATUS[t.status] ?? {
              label: t.status,
              tone: "bg-muted text-muted-foreground",
            };
            const count = messages.filter(
              (m) => m.thread_id === t.id && m.direction !== "note",
            ).length;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelected(t.id)}
                  className="w-full p-4 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      <Recipient thread={t} />
                    </span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", st.tone)}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">{t.purpose_en ?? t.subject ?? "Conversation"}</p>
                  {t.summary_en && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {t.summary_en}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground tnum">
                    {count} message{count === 1 ? "" : "s"}
                    {t.last_message_at &&
                      ` · last ${formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}`}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ThreadView({
  thread,
  messages,
  onBack,
  run,
  pending,
}: {
  thread: DealThread;
  messages: DealMessage[];
  onBack: () => void;
  run: Run;
  pending: string | null;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        Back to conversations
      </Button>
      <div className="rounded-2xl border bg-card p-5">
        <div className="text-sm">
          <Recipient thread={thread} />
        </div>
        <p className="mt-1 font-display text-xl font-semibold">
          {thread.purpose_en ?? thread.subject ?? "Conversation"}
        </p>
        {thread.summary_en && (
          <p className="mt-2 text-sm text-muted-foreground">{thread.summary_en}</p>
        )}
      </div>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-2xl border p-4",
              m.direction === "inbound" && "bg-card",
              m.direction === "outbound" && "bg-brand-soft/40 md:ml-10",
              m.direction === "note" && "border-dashed bg-muted/40",
            )}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {m.direction === "inbound"
                  ? "Received"
                  : m.direction === "note"
                    ? "Your private note"
                    : "Outgoing"}
              </span>
              {m.direction !== "note" && <span>· {MESSAGE_STATUS[m.status] ?? m.status}</span>}
              {m.ai_generated && (
                <span className="rounded-full border px-2 py-0.5">AI drafted</span>
              )}
              {m.is_binding && (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                  Binding
                </span>
              )}
              <span className="ml-auto tnum">
                {format(new Date(m.sent_at ?? m.created_at), "d MMM yyyy, HH:mm")}
              </span>
            </div>
            {m.subject && m.direction !== "note" && (
              <p className="mb-1 text-sm font-medium">{m.subject}</p>
            )}
            {m.status === "draft" && m.direction === "outbound" ? (
              <p className="text-sm text-muted-foreground">{m.body_original}</p>
            ) : (
              <Bilingual msg={m} />
            )}
            <Attachments value={m.attachments} />
            {m.direction === "outbound" && m.status === "approved" && (
              <SendYourself msg={m} thread={thread} run={run} pending={pending} />
            )}
          </li>
        ))}
      </ol>
      <form
        className="space-y-2 rounded-2xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const v = note.trim();
          if (!v) return;
          const ok = await run("note", () => addNote(thread.id, v), "Note saved");
          if (ok) setNote("");
        }}
      >
        <Label htmlFor="thread-note">Private note</Label>
        <Textarea
          id="thread-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Only you can see this. It is never sent."
        />
        <Button type="submit" size="sm" disabled={pending === "note" || !note.trim()}>
          Save note
        </Button>
      </form>
    </div>
  );
}

function Attachments({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return null;
  const files = value.filter(
    (a): a is { name?: string; url?: string } =>
      !!a && typeof a === "object" && ("url" in a || "name" in a),
  );
  if (!files.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((f, i) => (
        <li key={i}>
          {f.url ? (
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <FileText className="h-3 w-3" /> {f.name ?? "Attachment"}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
              <FileText className="h-3 w-3" /> {f.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function NewRequest({
  dealId,
  run,
  pending,
  onCreated,
}: {
  dealId: string;
  run: Run;
  pending: string | null;
  onCreated: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("comune_office");
  const [purpose, setPurpose] = useState<string>(REQUEST_PURPOSES[0]);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const isCustom = purpose === "custom";
  const finalPurpose = isCustom ? custom.trim() : purpose;
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <MessageSquarePlus /> New request
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New request</SheetTitle>
          <SheetDescription>
            Your agent writes it in Italian. Nothing is sent until you approve it.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6 px-4">
          <div className="space-y-2">
            <Label>Who should we contact?</Label>
            <RadioGroup value={kind} onValueChange={setKind}>
              {CONTACT_KINDS.map((k) => (
                <label key={k.value} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={k.value} /> {k.label}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>What do you need?</Label>
            <div className="flex flex-wrap gap-2">
              {[...REQUEST_PURPOSES, "custom" as const].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-left text-sm",
                    purpose === p && "border-foreground bg-foreground text-background",
                  )}
                >
                  {p === "custom" ? "Something else" : p}
                </button>
              ))}
            </div>
            {isCustom && (
              <Textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                rows={3}
                placeholder="Describe what you need in plain English"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Recipient details (optional)</Label>
            <p className="text-xs text-muted-foreground">
              If you know who to write to, add them. You can also add the address later.
            </p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name or office, e.g. Ufficio Patrimonio"
              maxLength={200}
            />
            <Input
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              placeholder="Organisation, e.g. Comune di Ragusa"
              maxLength={200}
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or PEC"
              maxLength={200}
              aria-invalid={!emailOk}
            />
            {!emailOk && (
              <p className="text-xs text-warning">That email address doesn't look right.</p>
            )}
          </div>
          <Button
            className="w-full"
            disabled={!finalPurpose || !emailOk || pending === "request"}
            onClick={async () => {
              let threadId = "";
              const ok = await run(
                "request",
                async () => {
                  const r = await draftMessage({
                    deal_id: dealId,
                    contact_kind: kind,
                    purpose: finalPurpose,
                    ...(name.trim()
                      ? {
                          contact: {
                            name: name.trim(),
                            organisation: organisation.trim(),
                            email: email.trim(),
                          },
                        }
                      : {}),
                  });
                  threadId = r.thread_id;
                },
                "Draft ready. Review it under Needs you.",
              );
              if (ok) {
                setOpen(false);
                setCustom("");
                setName("");
                setOrganisation("");
                setEmail("");
                onCreated(threadId);
              }
            }}
          >
            {pending === "request" ? "Writing in Italian" : "Draft the message"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------- Quotes ----------------

export function QuotesTab({ bundle, run, pending }: TabProps) {
  const { quotes, deal } = bundle;
  if (!quotes.length)
    return <Empty>No quotes yet. Ask a surveyor or contractor for one from Conversations.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="p-3">Provider</th>
            <th className="p-3">Service</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Available</th>
            <th className="p-3">Valid until</th>
            <th className="p-3">Replies in</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {quotes.map((q) => {
            const c = q.contacts;
            const stats = (c?.stats ?? {}) as { median_reply_hours?: number };
            const busy = pending?.startsWith(q.id) ?? false;
            return (
              <tr key={q.id} className="align-top">
                <td className="p-3">
                  <p className="font-medium">{c?.name ?? "Unknown"}</p>
                  {c?.organisation && (
                    <p className="text-xs text-muted-foreground">{c.organisation}</p>
                  )}
                  {c?.register_verified && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
                      <BadgeCheck className="h-3 w-3" /> Registered
                    </p>
                  )}
                </td>
                <td className="p-3">
                  <p>{q.service_en}</p>
                  {q.scope_en && <p className="mt-1 text-xs text-muted-foreground">{q.scope_en}</p>}
                </td>
                <td className="p-3 tnum">
                  {q.amount_eur != null ? (
                    <Money value={q.amount_eur} showOneEuroChip={false} />
                  ) : (
                    <span className="text-muted-foreground">Not given</span>
                  )}
                  {q.vat_included != null && (
                    <p className="text-xs text-muted-foreground">
                      {q.vat_included ? "VAT included" : "Plus VAT"}
                    </p>
                  )}
                </td>
                <td className="p-3 tnum">
                  {q.available_from
                    ? format(new Date(q.available_from), "d MMM yyyy")
                    : "Not given"}
                </td>
                <td className="p-3 tnum">
                  {q.valid_until ? format(new Date(q.valid_until), "d MMM yyyy") : "Not given"}
                </td>
                <td className="p-3 tnum">
                  {stats.median_reply_hours != null
                    ? `~${Math.round(stats.median_reply_hours)} h`
                    : "Unknown"}
                </td>
                <td className="p-3">
                  {q.status === "received" ? (
                    <div className="flex gap-2">
                      <ConfirmBinding
                        trigger={
                          <Button size="sm" disabled={busy}>
                            Accept
                          </Button>
                        }
                        title="Accept this quote?"
                        description={
                          <p>
                            Accepting tells the provider you want to go ahead. Payment happens
                            outside Odysstay, directly with them.
                          </p>
                        }
                        actionLabel="Accept quote"
                        onConfirm={(typed) =>
                          run(
                            `${q.id}-accept`,
                            () => setQuoteStatus(deal.id, q, "accepted", typed),
                            "Quote accepted",
                          )
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(
                            `${q.id}-decline`,
                            () => setQuoteStatus(deal.id, q, "declined", ""),
                            "Quote declined",
                          )
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize">
                      {q.status}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Documents ----------------

const DOC_KIND: Record<string, string> = {
  passport: "Passport",
  id_card: "ID card",
  codice_fiscale: "Codice fiscale",
  pec: "PEC details",
  proof_of_funds: "Proof of funds",
  power_of_attorney: "Power of attorney",
  signature: "Signature",
  other: "Other",
};

export function DocumentsTab({ bundle, run, pending }: TabProps) {
  const { deal, listing, vaultDocs } = bundle;
  const selected = parseDealNotes(deal.notes).documents;

  async function open(path: string) {
    const { data, error } = await supabase.storage.from("vault").createSignedUrl(path, 60);
    if (error || !data) throw error ?? new Error("Could not open the file");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="font-medium">Official notice</h3>
        {listing?.source_url ? (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            {listing.source_title ?? "Open the original notice"}{" "}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No link to the original notice.</p>
        )}
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Your documents for this deal</h3>
          <Button asChild variant="outline" size="sm">
            <Link to="/profile">Manage vault</Link>
          </Button>
        </div>
        {!vaultDocs.length ? (
          <Empty>
            Your vault is empty. Add your passport, codice fiscale and other papers once, and reuse
            them for every deal.
          </Empty>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {vaultDocs.map((d) => {
              const on = selected.includes(d.id);
              return (
                <li key={d.id} className="flex items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    aria-label={`Use ${d.label ?? DOC_KIND[d.kind] ?? d.kind} for this deal`}
                    checked={on}
                    disabled={pending === `doc-${d.id}`}
                    onChange={() => run(`doc-${d.id}`, () => toggleDealDocument(deal, d.id))}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.label ?? DOC_KIND[d.kind] ?? d.kind}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_KIND[d.kind] ?? d.kind}
                      {d.expires_on && ` · expires ${format(new Date(d.expires_on), "d MMM yyyy")}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(`open-${d.id}`, () => open(d.storage_path))}
                  >
                    Open
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------- Activity ----------------

const ACTION_LABEL: Record<string, string> = {
  deal_created: "Deal started",
  stage_changed: "Stage changed",
  message_approved: "Message approved",
  message_rejected: "Message rejected",
  message_marked_sent: "Message marked as sent",
  request_created: "Request created",
  drafted_message: "Drafted a message",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  message_sent: "Message sent",
  reply_received: "Reply received",
  follow_up_sent: "Follow-up sent",
};

export function ActivityTab({ bundle }: { bundle: DealBundle }) {
  if (!bundle.events.length) return <Empty>No activity yet.</Empty>;
  return (
    <ol className="space-y-3">
      {bundle.events.map((e) => {
        const Icon = e.actor === "agent" ? Bot : e.actor === "system" ? Wrench : User;
        const d = (e.detail ?? {}) as { from?: string; to?: string; purpose?: string };
        let text = ACTION_LABEL[e.action] ?? e.action.replace(/_/g, " ");
        if (e.action === "stage_changed" && d.from && d.to)
          text = `Stage: ${stageLabel(d.from)} to ${stageLabel(d.to)}`;
        if (e.action === "request_created" && d.purpose) text = `Request created: ${d.purpose}`;
        return (
          <li key={e.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm">
                <span className="font-medium">
                  {e.actor === "user" ? "You" : e.actor === "agent" ? "Agent" : "System"}
                </span>{" "}
                · {text}
              </p>
              <p className="text-xs text-muted-foreground tnum">
                {format(new Date(e.created_at), "d MMM yyyy, HH:mm")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------- Settings ----------------

export function DealSettings({ bundle, run, pending }: TabProps) {
  const { deal } = bundle;
  const [maxBid, setMaxBid] = useState(deal.max_bid_eur != null ? String(deal.max_bid_eur) : "");
  const [noteText, setNoteText] = useState(parseDealNotes(deal.notes).text);
  const closed = ["won", "lost", "withdrawn"].includes(deal.stage);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 /> Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Deal settings</SheetTitle>
          <SheetDescription>How your agent works on this deal.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-8 px-4 pb-8">
          <div className="space-y-3">
            <Label>Agent autonomy</Label>
            <RadioGroup
              value={deal.autonomy}
              onValueChange={(v) =>
                run("autonomy", () => updateDealSettings(deal.id, { autonomy: v }), "Saved")
              }
            >
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="ask_before_sending" className="mt-0.5" />
                <span>
                  <span className="font-medium">Ask me before sending anything</span>
                  <br />
                  <span className="text-muted-foreground">
                    Every message waits for your approval.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="auto_info_requests" className="mt-0.5" />
                <span>
                  <span className="font-medium">Send information requests automatically</span>
                  <br />
                  <span className="text-muted-foreground">
                    Questions and document requests go out on their own. Anything binding still
                    needs you.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-bid">Maximum bid (private, never shared)</Label>
            <div className="flex gap-2">
              <Input
                id="max-bid"
                inputMode="numeric"
                value={maxBid}
                onChange={(e) => setMaxBid(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="e.g. 45000"
              />
              <Button
                disabled={pending === "maxbid"}
                onClick={() =>
                  run(
                    "maxbid",
                    () =>
                      updateDealSettings(deal.id, { max_bid_eur: maxBid ? Number(maxBid) : null }),
                    "Saved",
                  )
                }
              >
                Save
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-notes">Your notes</Label>
            <Textarea
              id="deal-notes"
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <Button
              size="sm"
              disabled={pending === "notes"}
              onClick={() => {
                const cur = parseDealNotes(deal.notes);
                return run(
                  "notes",
                  () =>
                    updateDealSettings(deal.id, {
                      notes: serializeDealNotes({ ...cur, text: noteText }),
                    }),
                  "Saved",
                );
              }}
            >
              Save notes
            </Button>
          </div>
          {!closed && (
            <div className="space-y-2 border-t pt-6">
              <Label>Withdraw</Label>
              <p className="text-sm text-muted-foreground">
                Stops work on this deal. You can still read everything.
              </p>
              <Button
                variant="outline"
                className="text-warning"
                disabled={pending === "withdraw"}
                onClick={() => {
                  if (window.confirm("Withdraw from this deal?"))
                    void run("withdraw", () => withdrawDeal(deal), "Deal withdrawn");
                }}
              >
                Withdraw from deal
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
