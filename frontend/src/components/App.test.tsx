import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

import { App } from "@/components/App";
import { getSession } from "@/lib/auth";

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
