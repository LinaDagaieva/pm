export type Session = { authenticated: boolean; user: string | null };

export async function getSession(): Promise<Session> {
  const res = await fetch("/api/session");
  if (!res.ok) {
    return { authenticated: false, user: null };
  }
  return res.json();
}

export async function login(
  username: string,
  password: string
): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}
