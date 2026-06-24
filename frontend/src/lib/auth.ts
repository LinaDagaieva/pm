export type Session = {
  authenticated: boolean;
  user: string | null;
  error?: "network_error" | "server_error";
};

export async function getSession(): Promise<Session> {
  try {
    const res = await fetch("/api/session", { credentials: "include" });
    if (!res.ok) {
      return { authenticated: false, user: null, error: "server_error" };
    }
    return res.json();
  } catch {
    return { authenticated: false, user: null, error: "network_error" };
  }
}

export async function login(
  username: string,
  password: string
): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } catch (err) {
    console.error("Logout failed:", err);
  }
}
