"use client";

import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { sendChat, type ChatMessage } from "@/lib/chat";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardUpdate }: ChatSidebarProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) {
      return;
    }

    const history = messages;
    setMessages([...history, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const result = await sendChat(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply },
      ]);
      if (result.board) {
        onBoardUpdate(result.board);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 rounded-full bg-[var(--secondary-purple)] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        Ask AI
      </button>
    );
  }

  return (
    <aside
      aria-label="AI assistant"
      className="fixed bottom-6 right-6 flex h-[560px] w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-[28px] border border-[var(--stroke)] bg-white/95 shadow-[var(--shadow)] backdrop-blur"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Assistant
          </p>
          <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
            Board AI
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask me to add, move, edit, or remove cards, or rename a column. I can
            also answer questions about the board.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={clsx(
              "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6",
              message.role === "user"
                ? "self-end bg-[var(--primary-blue)] text-white"
                : "self-start border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.content}
          </div>
        ))}
        {loading && (
          <div className="self-start rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--gray-text)]">
            Thinking...
          </div>
        )}
        {error && (
          <p className="text-sm font-semibold text-[var(--secondary-purple)]">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-[var(--stroke)] px-4 py-3"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the assistant"
          aria-label="Message the assistant"
          className="flex-1 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
