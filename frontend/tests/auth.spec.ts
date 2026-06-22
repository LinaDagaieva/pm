import { expect, test } from "@playwright/test";
import { mockBoard } from "./fixtures";

test("logs in and back out", async ({ page }) => {
  let authed = false;
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: { authenticated: authed, user: authed ? "user" : null },
    })
  );
  await page.route("**/api/login", (route) => {
    authed = true;
    return route.fulfill({ json: { user: "user" } });
  });
  await page.route("**/api/logout", (route) => {
    authed = false;
    return route.fulfill({ json: { ok: true } });
  });
  await mockBoard(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("shows an error on invalid credentials", async ({ page }) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { authenticated: false, user: null } })
  );
  await page.route("**/api/login", (route) =>
    route.fulfill({ status: 401, json: { detail: "Invalid credentials" } })
  );

  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
});
