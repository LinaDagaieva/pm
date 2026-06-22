import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/board", () => ({
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
}));

import { App } from "@/components/App";
import { getSession } from "@/lib/auth";
import { getBoard } from "@/lib/board";
import { initialData } from "@/lib/kanban";

vi.mocked(getBoard).mockResolvedValue(structuredClone(initialData));

describe("App auth gate", () => {
  it("shows login when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("shows the board when authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: true, user: "user" });
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });
});
