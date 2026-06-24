import type { BoardData } from "@/lib/kanban";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatReply = { reply: string; board: BoardData | null };

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<ChatReply> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    credentials: "include",
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    throw new Error(detail);
  }
  return res.json();
}
