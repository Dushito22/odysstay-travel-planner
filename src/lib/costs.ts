import type { FeedRow } from "@/lib/feed";
import type { Lang } from "@/lib/i18n";

type Row = Pick<FeedRow, "price_eur" | "sale_type" | "occupancy" | "condition" | "red_flag_count" | "days_left" | "surface_sqm" | "score_reasons" | "property_type">;

export type CostPart = { label: string; eur: number };

const L = {
  en: { tax: "Purchase taxes (estimate)", notary: "Notary", court: "Court transfer and clearing", agency: "Agency fee, if any (3% + VAT)", survey: "Survey before you buy" },
  ru: { tax: "Налоги при покупке (оценка)", notary: "Нотариус", court: "Переход права и снятие обременений", agency: "Агентство, если есть (3% + НДС)", survey: "Проверка дома до покупки" },
};

const round = (n: number) => Math.round(n / 100) * 100;

/** What the buyer will really pay, roughly: price plus taxes, notary or court costs, agency and a survey.
 * Estimates only. Resale tax is charged on the cadastral value, which is usually well under the price,
 * so we take 60% of the price as a stand-in; the notary confirms the real figure. */
export function allInCost(r: Row, lang: Lang): { total: number; parts: CostPart[] } | null {
  const p = r.price_eur;
  if (p == null || p < 1000) return null;
  const t = L[lang];
  const auction = r.sale_type === "auction_judicial" || r.sale_type === "auction_notary";
  const parts: CostPart[] = [];
  parts.push({ label: t.tax, eur: round(Math.max(1000, 0.09 * p * (auction ? 1 : 0.6)) + 100) });
  if (auction) parts.push({ label: t.court, eur: 1500 });
  else parts.push({ label: t.notary, eur: round(Math.min(4000, 1500 + p * 0.01)) });
  if (r.sale_type === "sale") parts.push({ label: t.agency, eur: round(p * 0.03 * 1.22) });
  parts.push({ label: t.survey, eur: 600 });
  return { total: round(p + parts.reduce((a, x) => a + x.eur, 0)), parts };
}

/** The honest downsides, from what we know. The first one goes on the card. */
export function catches(r: Row, lang: Lang): string[] {
  const ru = lang === "ru";
  const out: string[] = [];
  const auction = r.sale_type === "auction_judicial" || r.sale_type === "auction_notary";
  if (r.occupancy === "occupied") out.push(ru ? "Там ещё живут: нужно время на выселение" : "Someone still lives there");
  if ((r.red_flag_count ?? 0) > 0) out.push(ru ? `Тревожных сигналов в документах: ${r.red_flag_count}` : `${r.red_flag_count} red flag${r.red_flag_count === 1 ? "" : "s"} in the papers`);
  if (r.condition === "ruin") out.push(ru ? "Руина: закладывайте полную перестройку" : "A ruin: budget for a full rebuild");
  else if (r.condition === "needs_work") out.push(ru ? "Нужен ремонт до переезда" : "Needs work before you can move in");
  if (r.sale_type === "one_euro") out.push(ru ? "Обязателен ремонт за 3 года и залог" : "Renovation within 3 years and a deposit required");
  if (auction && r.days_left != null && r.days_left >= 0 && r.days_left <= 14) out.push(ru ? `Торги через ${r.days_left} дн.` : `Bids close in ${r.days_left} days`);
  // The deal score's own minus points, like "-4 remote: no town within 25 km".
  for (const s of Array.isArray(r.score_reasons) ? r.score_reasons : []) {
    const far = typeof s === "string" ? s.match(/^-\d+ remote: nearest provincial town is (\d+) km away/) : null;
    if (far) out.push(ru ? `Далеко от города: ${far[1]} км до ближайшего` : `Remote: ${far[1]} km to the nearest town`);
  }
  if (r.surface_sqm != null && r.surface_sqm < 45 && r.property_type !== "land") out.push(ru ? `Маленький: ${Math.round(r.surface_sqm)} м²` : `Small: ${Math.round(r.surface_sqm)} m²`);
  if (auction && (r.occupancy == null || r.occupancy === "unknown")) out.push(ru ? "В объявлении не сказано, свободен ли дом" : "Not stated whether it's empty");
  if (!r.condition && r.property_type !== "land") out.push(ru ? "Состояние не указано" : "Condition not stated");
  return out;
}
