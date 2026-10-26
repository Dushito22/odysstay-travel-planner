import { describe, expect, it } from "vitest";

import { forYouScore, sortFeed, type FeedRow } from "../feed";
import type { Profile } from "../profile";

const p = { preferred_regions: ["Toscana"], budget_max_eur: 100000 } as unknown as Profile;
const row = (o: Partial<FeedRow>) => ({ score: 50, region: "Lazio", price_eur: 50000, ...o }) as FeedRow;

describe("For you score", () => {
  it("adds 10 for a preferred region", () => {
    expect(forYouScore(row({ region: "Toscana", price_eur: null }), p)).toBe(60);
  });
  it("adds 10 when within budget", () => {
    expect(forYouScore(row({ price_eur: 90000 }), p)).toBe(60);
  });
  it("subtracts 30 when over budget", () => {
    expect(forYouScore(row({ price_eur: 120000 }), p)).toBe(20);
  });
});

describe("Closing soon sort", () => {
  it("keeps only positive days left, soonest first", () => {
    const out = sortFeed([row({ days_left: 20 }), row({ days_left: -3 }), row({ days_left: 5 })], "closing", p);
    expect(out.map((r) => r.days_left)).toEqual([5, 20]);
  });
});
