import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { searchFromFilters, summarizeFilters } from "../saved";
import { expiryState, validateFile } from "../vault";

describe("saved search summaries", () => {
  it("reads like plain English", () => {
    expect(
      summarizeFilters({ regions: ["Sardegna", "Sicilia"], maxPrice: 80000, types: ["house"] }),
    ).toBe("Sardegna, Sicilia · under €80,000 · houses");
  });
  it("defaults to all of Italy", () => {
    expect(summarizeFilters({})).toBe("All of Italy");
  });
  it("mentions non-default switches", () => {
    expect(
      summarizeFilters({
        unsold: true,
        leases: true,
        oneEuro: false,
        minScore: 70,
        types: ["land"],
      }),
    ).toBe(
      "All of Italy · land · score 70+ · previously unsold · incl. concessions and leases · no one-euro schemes",
    );
  });
  it("rebuilds a safe discover search from stored JSON", () => {
    const s = searchFromFilters({
      regions: ["Lazio", 3],
      maxPrice: "x",
      hideClosed: false,
      evil: "<script>",
    } as never);
    expect(s).toEqual({
      sort: "best",
      regions: ["Lazio"],
      types: [],
      maxPrice: 0,
      minSurface: 0,
      minScore: 0,
      minDiscount: 0,
      leases: false,
      oneEuro: true,
      unsold: false,
      hideClosed: false,
      prefs: false,
    });
  });
});

describe("vault helpers", () => {
  const now = new Date("2026-10-26T12:00:00");
  it("flags documents expiring within 30 days and expired ones", () => {
    expect(expiryState("2026-11-10", now)).toBe("soon");
    expect(expiryState("2026-10-01", now)).toBe("expired");
    expect(expiryState("2027-06-01", now)).toBeNull();
    expect(expiryState(null, now)).toBeNull();
  });
  it("accepts PDFs and photos up to 20 MB only", () => {
    const f = (type: string, size: number) => ({ type, size, name: "x" }) as File;
    expect(validateFile(f("application/pdf", 1000))).toBeNull();
    expect(validateFile(f("image/jpeg", 1000))).toBeNull();
    expect(validateFile(f("application/x-msdownload", 1000))).toMatch(/PDF or a photo/);
    expect(validateFile(f("application/pdf", 21 * 1024 * 1024))).toMatch(/20 MB/);
  });
});
