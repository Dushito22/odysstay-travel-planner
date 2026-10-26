import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approveMessage = vi.fn(async () => {});
const rejectMessage = vi.fn(async () => {});

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/deal", async (orig) => {
  const actual = await orig<typeof import("@/lib/deal")>();
  return {
    ...actual,
    approveMessage: (...a: Parameters<typeof actual.approveMessage>) => {
      actual.assertConfirmed(a[0].is_binding, a[2]); // keep the real guard
      return approveMessage(...(a as []));
    },
    rejectMessage: (...a: unknown[]) => rejectMessage(...(a as [])),
  };
});

import { ApprovalCard } from "../MessageView";
import type { DealMessage, DealThread } from "@/lib/deal";

const baseMsg: DealMessage = {
  id: "m1",
  thread_id: "t1",
  direction: "outbound",
  status: "awaiting_approval",
  is_binding: false,
  language: "it",
  subject: "Richiesta planimetria",
  body_original: "Gentile ufficio, chiedo la planimetria.",
  body_en: "Dear office, I am asking for the floor plan.",
  attachments: [],
  ai_generated: true,
  approved_by: null,
  approved_at: null,
  sent_at: null,
  created_at: "2026-10-26T10:00:00Z",
};

const thread = {
  id: "t1",
  deal_id: "d1",
  contact_id: null,
  channel: "email",
  subject: null,
  purpose_en: "Ask for the floor plan",
  status: "needs_you",
  summary_en: null,
  last_message_at: null,
  created_at: "2026-10-26T10:00:00Z",
  contacts: null,
} as DealThread;

/** Minimal stand-in for useDealAction: runs the action and reports success. */
const run = async (_k: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
};

describe("ApprovalCard", () => {
  beforeEach(() => {
    approveMessage.mockClear();
    rejectMessage.mockClear();
  });

  it("shows English by default and the Italian on toggle", () => {
    render(<ApprovalCard msg={baseMsg} thread={thread} userId="u1" run={run} pending={null} />);
    expect(screen.getByText(/asking for the floor plan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Original/ }));
    expect(screen.getByText(/chiedo la planimetria/)).toBeInTheDocument();
  });

  it("approves a non-binding message in one click", async () => {
    render(<ApprovalCard msg={baseMsg} thread={thread} userId="u1" run={run} pending={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approveMessage).toHaveBeenCalledTimes(1));
  });

  it("does not approve a binding message until CONFIRM is typed", async () => {
    render(
      <ApprovalCard
        msg={{ ...baseMsg, is_binding: true }}
        thread={thread}
        userId="u1"
        run={run}
        pending={null}
      />,
    );
    expect(screen.getByText("Binding: this commits you")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const action = await screen.findByRole("button", { name: "Approve and commit" });
    expect(action).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type CONFIRM to continue"), {
      target: { value: "confirm" },
    });
    expect(action).toBeDisabled();
    expect(approveMessage).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Type CONFIRM to continue"), {
      target: { value: "CONFIRM" },
    });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    await waitFor(() => expect(approveMessage).toHaveBeenCalledTimes(1));
  });

  it("rejects", async () => {
    render(<ApprovalCard msg={baseMsg} thread={thread} userId="u1" run={run} pending={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(rejectMessage).toHaveBeenCalledTimes(1));
  });
});
