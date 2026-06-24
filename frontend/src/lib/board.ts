import type { BoardData } from "@/lib/kanban";

export async function getBoard(): Promise<BoardData> {
  const res = await fetch("/api/board", { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to load board");
  }
  return res.json();
}

export async function saveBoard(board: BoardData): Promise<void> {
  const res = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to save board");
  }
}
