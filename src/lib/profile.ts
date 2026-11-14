import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export const REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia",
  "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna",
  "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

export const INTENTS = [
  { value: "live", label: "Live there" },
  { value: "holiday_home", label: "Holiday home" },
  { value: "rental_income", label: "Rental income" },
  { value: "renovate_and_sell", label: "Renovate and sell" },
  { value: "not_sure", label: "Not sure yet" },
];

export const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "rural_house", label: "Rural house" },
  { value: "building", label: "Building" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
];

export async function fetchMyProfile(): Promise<Profile | null> {
  // The id from the local session; row-level security checks the token on the query itself.
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

export const profileQuery = queryOptions({ queryKey: ["profile"], queryFn: fetchMyProfile });

export async function saveProfile(patch: ProfileUpdate) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles").upsert({ ...patch, id: u.user.id });
  if (error) throw error;
}
