import { describe, expect, it } from "vitest";

import { parseRequest } from "./argos";

describe("parseRequest", () => {
  it("reads budget, region and type", () => {
    const s = parseRequest("Something in Puglia under 40k, a house I can do some work on");
    expect(s.filters.maxPrice).toBe(40000);
    expect(s.filters.regions).toEqual(["Puglia"]);
    expect(s.filters.types).toContain("house");
    expect(s.understood).toContain("happy to renovate");
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
