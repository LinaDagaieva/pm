import { expect, test } from "@playwright/test";
import { mockBoard, mockSession, seedBoard } from "./fixtures";

test("an AI instruction visibly updates the board", async ({ page }) => {
  await mockSession(page, true);
  await mockBoard(page);

  const updated = structuredClone(seedBoard);
  updated.cards["card-ai"] = {
    id: "card-ai",
    title: "AI added card",
    details: "By assistant.",
  };
  updated.columns[0].cardIds.push("card-ai");
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({ json: { reply: "Added it", board: updated } })
  );

  await page.goto("/");
  await page.getByRole("button", { name: /ask ai/i }).click();
  await page.getByLabel("Message the assistant").fill("Add a card to Backlog");
  await page.getByRole("button", { name: /send/i }).click();

  await expect(page.getByText("Added it")).toBeVisible();
  await expect(page.getByText("AI added card")).toBeVisible();
});
