import { describe, expect, it } from "vitest";

import { parseRequest } from "./argos";

describe("parseRequest", () => {
  it("reads budget, region and type", () => {
    const s = parseRequest("Something in Puglia under 40k, a house I can do some work on");
    expect(s.filters.maxPrice).toBe(40000);
    expect(s.filters.regions).toEqual(["Puglia"]);
    expect(s.filters.types).toContain("house");
    expect(s.understood).toContain("happy to do some work");
  });
  it("turns a ceiling into a band, so 'under 50k' is not a €4k field", () => {
    expect(parseRequest("a stone house under €50k, some work is fine").filters).toMatchObject({ minPrice: 30000, maxPrice: 50000 });
    expect(parseRequest("around 40k in Abruzzo").filters).toMatchObject({ minPrice: 30000, maxPrice: 45000 });
    expect(parseRequest("under 15k").filters).toMatchObject({ minPrice: 0, maxPrice: 15000 });
  });
  it("reads euro amounts with separators and Russian", () => {
    expect(parseRequest("budget €50,000 Sicily").filters.maxPrice).toBe(50000);
    expect(parseRequest("дом на Сицилии до 30 тысяч евро").filters).toMatchObject({ maxPrice: 30000, regions: ["Sicilia"] });
  });
  it("knows the €1 houses and broad areas", () => {
    expect(parseRequest("one of those 1 euro houses in the south").oneEuroOnly).toBe(true);
    expect(parseRequest("somewhere in the south").filters.regions).toContain("Calabria");
  });
  it("says what it cannot filter yet", () => {
    expect(parseRequest("a flat by the sea in Liguria").notYet).toContain("by the sea");
  });
});
