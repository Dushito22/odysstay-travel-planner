import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ExternalLink, FileText, Lock, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/odys/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { profileQuery } from "@/lib/profile";
import {
  deleteDocument,
  expiryState,
  MAX_FILE_MB,
  openDocument,
  uploadDocument,
  validateFile,
  VAULT_KINDS,
  vaultQuery,
  type VaultDocument,
} from "@/lib/vault";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({ meta: [{ title: "Document vault | Odysstay" }] }),
  component: VaultPage,
});

function VaultPage() {
  const q = useQuery(vaultQuery);
  const [uploadKind, setUploadKind] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Document vault"
        intro="Keep your papers once and reuse them for every deal. Files are private to you and open only through links that expire after a minute."
      />
      {q.error ? (
        <div className="rounded-2xl border bg-card p-8">
          <p className="text-warning">Could not load your documents.</p>
          <Button className="mt-4" variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      ) : q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {VAULT_KINDS.map((k) => (
            <KindCard
              key={k.value}
              kind={k}
              docs={(q.data ?? []).filter((d) => d.kind === k.value)}
              onUpload={() => setUploadKind(k.value)}
            />
          ))}
        </div>
      )}
      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Only you can see these files. Odysstay staff can't browse
        your vault.
      </p>
      {uploadKind && <UploadDialog kind={uploadKind} onClose={() => setUploadKind(null)} />}
    </>
  );
}

function KindCard({
  kind,
  docs,
  onUpload,
}: {
  kind: (typeof VAULT_KINDS)[number];
  docs: VaultDocument[];
  onUpload: () => void;
}) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">{kind.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{kind.why}</p>
          {"link" in kind && (
            <a
              href={kind.link.href}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              {kind.link.label} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onUpload}>
          <Upload /> Add
        </Button>
      </div>
      {docs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {docs.map((d) => (
            <DocRow key={d.id} doc={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocRow({ doc }: { doc: VaultDocument }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const exp = expiryState(doc.expires_on);
  return (
    <li className="flex items-center gap-3 rounded-xl border p-3">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {doc.label ??
            doc.storage_path
              .split("/")
              .pop()
              ?.replace(/^[0-9a-f-]{36}-/, "")}
        </p>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            exp === "soon" && "text-caution",
            exp === "expired" && "text-warning",
          )}
        >
          Added {format(new Date(doc.created_at), "d MMM yyyy")}
          {doc.expires_on &&
            ` · ${exp === "expired" ? "expired" : "expires"} ${format(new Date(doc.expires_on), "d MMM yyyy")}`}
          {exp === "soon" && " · renew soon"}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          try {
            await openDocument(doc.storage_path);
          } catch {
            toast.error("Could not open the file");
          }
        }}
      >
        Open
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Delete document" disabled={busy}>
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              The file is removed permanently from your vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteDocument(doc);
                  await qc.invalidateQueries({ queryKey: ["vault"] });
                  await qc.invalidateQueries({ queryKey: ["deal"] });
                  toast.success("Deleted");
                } catch {
                  toast.error("Could not delete it");
                  setBusy(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function UploadDialog({ kind, onClose }: { kind: string; onClose: () => void }) {
  const qc = useQueryClient();
  const meta = VAULT_KINDS.find((k) => k.value === kind);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const err = file ? validateFile(file) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {meta?.label.toLowerCase() ?? "document"}</DialogTitle>
          <DialogDescription>PDF or photo, up to {MAX_FILE_MB} MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vault-file">File</Label>
            <Input
              id="vault-file"
              ref={input}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {err && <p className="text-sm text-warning">{err}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vault-label">Name (optional)</Label>
            <Input
              id="vault-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              placeholder={meta?.label}
            />
          </div>
          {(kind === "passport" ||
            kind === "id_card" ||
            kind === "proof_of_funds" ||
            kind === "power_of_attorney") && (
            <div className="space-y-2">
              <Label htmlFor="vault-exp">Expiry date (optional)</Label>
              <Input
                id="vault-exp"
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!file || !!err || busy}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              try {
                await uploadDocument({ file, kind, label, expiresOn: expires || null });
                await Promise.all([
                  qc.invalidateQueries({ queryKey: ["vault"] }),
                  qc.invalidateQueries({ queryKey: profileQuery.queryKey }),
                  qc.invalidateQueries({ queryKey: ["deal"] }),
                ]);
                toast.success("Saved to your vault");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Upload failed");
                setBusy(false);
              }
            }}
          >
            {busy ? "Uploading" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
