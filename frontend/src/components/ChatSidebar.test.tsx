import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat", () => ({ sendChat: vi.fn() }));

import { ChatSidebar } from "@/components/ChatSidebar";
import { sendChat } from "@/lib/chat";
import { initialData } from "@/lib/kanban";

beforeEach(() => {
  vi.clearAllMocks();
});

const open = async () =>
  userEvent.click(screen.getByRole("button", { name: /ask ai/i }));

describe("ChatSidebar", () => {
  it("sends a message and shows the user message and reply", async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: "Sure thing", board: null });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await open();
    await userEvent.type(
      screen.getByLabelText(/message the assistant/i),
      "How many cards?"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Sure thing")).toBeInTheDocument();
    expect(screen.getByText("How many cards?")).toBeInTheDocument();
    expect(sendChat).toHaveBeenCalledWith("How many cards?", []);
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("shows the server error message when the request fails", async () => {
    vi.mocked(sendChat).mockRejectedValue(
      new Error("OPENROUTER_API_KEY is not set")
    );
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);

    await open();
    await userEvent.type(
      screen.getByLabelText(/message the assistant/i),
      "hi"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText(/OPENROUTER_API_KEY is not set/i)
    ).toBeInTheDocument();
  });

  it("refreshes the board when the AI returns an update", async () => {
    const board = structuredClone(initialData);
    vi.mocked(sendChat).mockResolvedValue({ reply: "Done", board });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await open();
    await userEvent.type(
      screen.getByLabelText(/message the assistant/i),
      "add a card"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onBoardUpdate).toHaveBeenCalledWith(board));
  });
});
