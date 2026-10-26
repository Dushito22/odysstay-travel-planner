import { describe, expect, it } from "vitest";

import { buildTasks, grantDeduction, orderFlags, pickEstimates, type CostEstimate, type RedFlag } from "../listing";

describe("default deal tasks", () => {
  const listing = { source_url: "https://comune.example/notice.pdf", deadline_at: "2026-11-17" };
  it("creates 9 tasks sorted 1..9", () => {
    const t = buildTasks("d1", listing, null);
    expect(t).toHaveLength(9);
    expect(t.map((x) => x.sort)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("links task 1 to the notice and task 2 to the tax agency", () => {
    const t = buildTasks("d1", listing, null);
    expect(t[0]?.official_url).toBe("https://comune.example/notice.pdf");
    expect(t[1]?.official_url).toBe("https://www.agenziaentrate.gov.it");
  });
  it("sets deposit and offer due dates to the deadline", () => {
    const t = buildTasks("d1", listing, null);
    expect(t[6]?.due_at).toBe("2026-11-17");
    expect(t[7]?.due_at).toBe("2026-11-17");
  });
  it("marks codice fiscale and PEC tasks done when the profile has them", () => {
    const t = buildTasks("d1", listing, { has_codice_fiscale: true, has_pec: true });
    expect(t[1]?.status).toBe("done");
    expect(t[2]?.status).toBe("done");
    expect(t[3]?.status).toBe("todo");
  });
});

describe("grant deduction", () => {
  it("uses min of max_eur and pct of renovation", () => {
    expect(grantDeduction({ max_eur: 20000, pct: 50 }, 30000)).toBe(15000);
    expect(grantDeduction({ max_eur: 10000, pct: 50 }, 30000)).toBe(10000);
  });
  it("is not applied without both max_eur and pct", () => {
    expect(grantDeduction({ max_eur: 10000, pct: null }, 30000)).toBeNull();
  });
});

describe("ordering", () => {
  it("orders red flags high, medium, low", () => {
    const f = orderFlags([{ severity: "low" }, { severity: "high" }, { severity: "medium" }] as RedFlag[]);
    expect(f.map((x) => x.severity)).toEqual(["high", "medium", "low"]);
  });
  it("prefers the user's own estimate over the default", () => {
    const rows = [
      { scenario: "light", user_id: null, low_eur: 1 },
      { scenario: "light", user_id: "u1", low_eur: 2 },
    ] as CostEstimate[];
    expect(pickEstimates(rows, "u1")[0]?.low_eur).toBe(2);
  });
});
