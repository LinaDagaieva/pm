import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/board", () => ({
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
}));

import { KanbanBoard } from "@/components/KanbanBoard";
import { getBoard, saveBoard } from "@/lib/board";
import { initialData } from "@/lib/kanban";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBoard).mockResolvedValue(structuredClone(initialData));
  vi.mocked(saveBoard).mockResolvedValue();
});

const getFirstColumn = async () => (await screen.findAllByTestId(/column-/i))[0];

describe("KanbanBoard", () => {
  it("loads and renders five columns from the API", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(getBoard).toHaveBeenCalled();
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds a card and persists via the API", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );

    await userEvent.type(
      within(column).getByPlaceholderText(/card title/i),
      "New card"
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/details/i),
      "Notes"
    );
    await userEvent.click(
      within(column).getByRole("button", { name: /add card/i })
    );

    expect(within(column).getByText("New card")).toBeInTheDocument();

    // The debounced save persists the whole board including the new card.
    await waitFor(() => {
      const saved = vi.mocked(saveBoard).mock.calls.at(-1)?.[0];
      const titles = saved ? Object.values(saved.cards).map((c) => c.title) : [];
      expect(titles).toContain("New card");
    });
  });

  it("removes a card", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/card title/i),
      "Temp card"
    );
    await userEvent.click(
      within(column).getByRole("button", { name: /add card/i })
    );

    await userEvent.click(
      within(column).getByRole("button", { name: /delete temp card/i })
    );
    expect(within(column).queryByText("Temp card")).not.toBeInTheDocument();
  });
});
