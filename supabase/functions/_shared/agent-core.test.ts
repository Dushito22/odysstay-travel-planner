import { describe, expect, it } from "vitest";

import {
  buildAgentContext,
  buildDraftContext,
  ensureDisclosure,
  parseAgentReply,
  parseDraft,
  renderPrompt,
  type FactRow,
  type FlagRow,
  type GrantRow,
  type ListingRow,
} from "./agent-core";

const facts: FactRow[] = [
  {
    id: "f1",
    key: "deadline",
    label_en: "Offer deadline",
    value_text: "17 July 2026",
    value_num: null,
    quote: "entro le ore 12:00 del 17 luglio 2026",
    quote_en: "by 12:00 on 17 July 2026",
  },
  {
    id: "f2",
    key: "price_eur",
    label_en: "Base price",
    value_text: "€36,000",
    value_num: 36000,
    quote: "euro 36.000,00",
    quote_en: "€36,000",
  },
];
const flags: FlagRow[] = [
  {
    id: "r1",
    flag_en: "Roof leaks",
    severity: "high",
    quote: "infiltrazioni dal tetto",
    quote_en: "leaks from the roof",
  },
];
const grants: GrantRow[] = [
  {
    id: "g1",
    name: "Sardinia small-comuni first-home grant",
    summary_en: "50%",
    max_eur: 15000,
    pct: 50,
    conditions_en: null,
    source_url: "https://regione.sardegna.it",
  },
];
const listing: ListingRow = {
  id: "l1",
  comune: "Ragusa",
  province: "RG",
  region: "Sicilia",
  address: "Via Modigliani",
  lot: null,
  title_en: "House",
  summary_en: "A house.",
  property_type: "house",
  sale_type: "sale",
  price_eur: 36000,
  surface_sqm: 85,
  land_sqm: null,
  deadline_at: "2026-07-17",
  source_url: "https://comune.ragusa.it/avviso.pdf",
  source_title: "Avviso",
  source_published_at: "2026-06-30",
};
const ctx = { facts, flags, grants, sourceUrl: listing.source_url };

describe("parseAgentReply", () => {
  it("maps citations to verified sources and keeps them unique", () => {
    const r = parseAgentReply(
      "Offers close on 17 July 2026 [fact:deadline]. The base price is €36,000 [fact:price_eur] [fact:deadline]. The roof leaks [flag:1]. See [notice].",
      ctx,
    );
    expect(r.citations.map((c) => `${c.type}:${c.id}`)).toEqual([
      "fact:deadline",
      "fact:price_eur",
      "flag:1",
      "notice:notice",
    ]);
    expect(r.citations[0]?.quote).toBe("entro le ore 12:00 del 17 luglio 2026");
    expect(r.citations[3]?.url).toBe(listing.source_url);
    expect(r.actions).toEqual([]);
  });

  it("drops citations that point at nothing", () => {
    const r = parseAgentReply("Taxes are 9% [fact:imu_tax] [flag:7] [grant:Made up grant].", ctx);
    expect(r.citations).toEqual([]);
  });

  it("matches grants by name and links the official page", () => {
    const r = parseAgentReply(
      "You may qualify [grant:Sardinia small-comuni first-home grant].",
      ctx,
    );
    expect(r.citations[0]).toMatchObject({ type: "grant", url: "https://regione.sardegna.it" });
  });

  it("extracts and strips the ACTIONS line", () => {
    const r = parseAgentReply(
      'The notice doesn\'t state property taxes. A tax adviser would know.\nACTIONS: draft_message(lawyer, "Ask about yearly property taxes") | add_task(Find a tax adviser)',
      ctx,
    );
    expect(r.content).not.toContain("ACTIONS");
    expect(r.actions).toEqual([
      { type: "draft_message", contact_kind: "lawyer", purpose: "Ask about yearly property taxes" },
      { type: "add_task", title: "Find a tax adviser" },
    ]);
  });

  it("normalises unknown contact kinds to other", () => {
    const r = parseAgentReply("x\nACTIONS: draft_message(mayor, Ask for a meeting)", ctx);
    expect(r.actions[0]).toEqual({
      type: "draft_message",
      contact_kind: "other",
      purpose: "Ask for a meeting",
    });
  });
});

describe("parseDraft and disclosure", () => {
  it("parses JSON even with surrounding text", () => {
    const d = parseDraft(
      'Here it is:\n{"subject":"Richiesta","body_it":"Gentile ufficio","body_en":"Dear office","is_binding":false}',
    );
    expect(d).toEqual({
      subject: "Richiesta",
      body_it: "Gentile ufficio",
      body_en: "Dear office",
      is_binding: false,
    });
  });

  it("only treats is_binding true as binding", () => {
    expect(
      parseDraft('{"subject":"a","body_it":"b","body_en":"c","is_binding":"yes"}').is_binding,
    ).toBe(false);
    expect(
      parseDraft('{"subject":"a","body_it":"b","body_en":"c","is_binding":true}').is_binding,
    ).toBe(true);
  });

  it("rejects incomplete drafts", () => {
    expect(() => parseDraft('{"subject":"a","body_it":"","body_en":"c"}')).toThrow();
    expect(() => parseDraft("no json here")).toThrow();
  });

  it("adds the AI disclosure when the model forgets it", () => {
    expect(ensureDisclosure("Gentile ufficio, chiedo...", "Dushan Petrov")).toMatch(
      /^Le scrivo in qualità di assistente digitale basato su intelligenza artificiale, per conto di Dushan Petrov/,
    );
    const already =
      "Le scrivo in qualità di assistente digitale basato su intelligenza artificiale per conto di X.";
    expect(ensureDisclosure(already, "X")).toBe(already);
  });
});

describe("context builders", () => {
  it("puts verified facts, flags and notice text in the agent context", () => {
    const c = buildAgentContext({
      listing,
      facts,
      flags,
      estimates: [],
      grants,
      noticeText: "AVVISO D'ASTA ".repeat(5000),
      deal: null,
      profile: null,
    });
    expect(c).toContain(
      '[fact:deadline] Offer deadline: 17 July 2026 | quote: "entro le ore 12:00 del 17 luglio 2026"',
    );
    expect(c).toContain("[flag:1] (high) Roof leaks");
    expect(c.length).toBeLessThan(45000); // notice text is capped
  });

  it("adds court-sale details and published contacts when present", () => {
    const c = buildAgentContext({
      listing: {
        ...listing, court: "Tribunale di Perugia", case_ref: "R.G.E. 43/2025, lotto 1", min_offer_eur: 28500,
        appraisal_eur: 71000, discount_pct: 60,
        contacts: [{ role: "Sale delegate", name: "Mario Rossi", email: "m@example.it", phone: "333" }],
        attachments: [{ kind: "appraisal", name: "Perizia.pdf", url: "https://x" }],
      },
      facts, flags, estimates: [], grants, noticeText: null, deal: null, profile: null,
    });
    expect(c).toContain('"court":"Tribunale di Perugia"');
    expect(c).toContain('"name":"Mario Rossi"');
    expect(c).toContain('"kind":"appraisal"');
    expect(c).not.toContain("333"); // phone numbers are not needed by the agent
  });

  it("draft context only carries the facts a letter needs", () => {
    const c = buildDraftContext({
      listing,
      facts,
      fullName: "Dushan",
      contactKind: "comune_office",
      purpose: "Ask for the floor plan",
      contact: null,
      history: [],
    });
    expect(c).toContain("Buyer full name: Dushan");
    expect(c).toContain("Offer deadline");
  });
});

describe("renderPrompt", () => {
  it("builds a generation prompt only from listing facts and labels it as a concept", () => {
    const p = renderPrompt(listing, "Modern Mediterranean", false);
    expect(p).toContain("about 85 square metres");
    expect(p).toContain("Ragusa, Sicilia");
    expect(p).toContain("Concept illustration, not a real photo.");
  });
  it("keeps structure when editing a real photo", () => {
    expect(renderPrompt(listing, "Rustic farmhouse", true)).toContain("keep the structure");
  });
});
