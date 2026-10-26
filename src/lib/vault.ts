import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VaultDocument = Database["public"]["Tables"]["user_documents"]["Row"];

export const VAULT_KINDS = [
  {
    value: "passport",
    label: "Passport",
    why: "Needed for the codice fiscale, the deposit and the deed.",
  },
  { value: "id_card", label: "ID card", why: "An alternative to the passport for EU citizens." },
  {
    value: "codice_fiscale",
    label: "Codice fiscale",
    why: "Italian tax number. You need it to buy property or pay a deposit.",
    link: { href: "https://www.agenziaentrate.gov.it", label: "Agenzia delle Entrate" },
  },
  {
    value: "pec",
    label: "PEC (certified email)",
    why: "Some public sales require offers or documents to arrive by PEC.",
  },
  {
    value: "proof_of_funds",
    label: "Proof of funds",
    why: "Some sellers ask for it before a viewing or with an offer.",
  },
  {
    value: "power_of_attorney",
    label: "Power of attorney",
    why: "Lets someone act for you at the notary if you can't be in Italy. It must be notarised.",
  },
  { value: "other", label: "Other", why: "Anything else you want to keep with your deals." },
] as const;

export const MAX_FILE_MB = 20;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];

export const vaultQuery = queryOptions({
  queryKey: ["vault"],
  queryFn: async (): Promise<VaultDocument[]> => {
    const { data, error } = await supabase
      .from("user_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 8)
      : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return ext ? `${base || "file"}.${ext}` : base || "file";
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Files up to ${MAX_FILE_MB} MB, please.`;
  if (file.type && !ALLOWED.includes(file.type))
    return "Upload a PDF or a photo (JPG, PNG, HEIC, WebP).";
  return null;
}

export async function uploadDocument(input: {
  file: File;
  kind: string;
  label: string;
  expiresOn: string | null;
}) {
  const err = validateFile(input.file);
  if (err) throw new Error(err);
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in first");
  const path = `${u.user.id}/${crypto.randomUUID()}-${safeName(input.file.name)}`;
  const up = await supabase.storage
    .from("vault")
    .upload(path, input.file, {
      upsert: false,
      ...(input.file.type ? { contentType: input.file.type } : {}),
    });
  if (up.error) throw up.error;
  const { error } = await supabase.from("user_documents").insert({
    user_id: u.user.id,
    kind: input.kind,
    label: input.label.trim() || null,
    storage_path: path,
    expires_on: input.expiresOn || null,
  });
  if (error) {
    await supabase.storage.from("vault").remove([path]);
    throw error;
  }
  // Having the document means the user has it: keep onboarding flags in sync.
  if (input.kind === "codice_fiscale" || input.kind === "pec") {
    await supabase
      .from("profiles")
      .update(input.kind === "pec" ? { has_pec: true } : { has_codice_fiscale: true })
      .eq("id", u.user.id);
  }
}

/** Opens a private file through a link that expires after 60 seconds. */
export async function openDocument(path: string) {
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("vault").createSignedUrl(path, 60);
  if (error || !data) {
    win?.close();
    throw error ?? new Error("Could not open the file");
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

export async function deleteDocument(doc: VaultDocument) {
  const rm = await supabase.storage.from("vault").remove([doc.storage_path]);
  if (rm.error) throw rm.error;
  const { error } = await supabase.from("user_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export function expiryState(expiresOn: string | null, now = new Date()): "expired" | "soon" | null {
  if (!expiresOn) return null;
  const days = (new Date(`${expiresOn}T23:59:59`).getTime() - now.getTime()) / 86400000;
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return null;
}
