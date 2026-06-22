"use client";

import { useEffect, useState } from "react";
import { getSession, logout } from "@/lib/auth";
import { Login } from "@/components/Login";
import { KanbanBoard } from "@/components/KanbanBoard";

type Status = "loading" | "authed" | "anon";

export const App = () => {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getSession().then((s) => setStatus(s.authenticated ? "authed" : "anon"));
  }, []);

  if (status === "loading") {
    return null;
  }

  if (status === "anon") {
    return <Login onSuccess={() => setStatus("authed")} />;
  }

  return (
    <KanbanBoard
      onLogout={async () => {
        await logout();
        setStatus("anon");
      }}
    />
  );
};
