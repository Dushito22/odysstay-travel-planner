import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeadlinePill } from "../primitives";

const now = new Date("2026-10-01T12:00:00Z");
describe("DeadlinePill", () => {
  it("shows days left at 15 or more days", () => {
    render(<DeadlinePill deadline="2026-10-24T12:00:00Z" now={now} />);
    expect(screen.getByText("23 days left")).toBeTruthy();
  });
  it("shows closes in under 15 days", () => {
    render(<DeadlinePill deadline="2026-10-06T12:00:00Z" now={now} />);
    expect(screen.getByText("Closes in 5 days")).toBeTruthy();
  });
  it("shows closed when past", () => {
    render(<DeadlinePill deadline="2026-09-28T12:00:00Z" now={now} />);
    expect(screen.getByText("Closed")).toBeTruthy();
  });
});
