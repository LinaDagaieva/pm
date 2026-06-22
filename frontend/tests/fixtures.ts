import type { Page } from "@playwright/test";

export const seedBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Themes." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Signals." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Labels." },
    "card-5": { id: "card-5", title: "Design card layout", details: "Hierarchy." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "States." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Copy." },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Notes." },
  },
};

export async function mockSession(page: Page, authenticated: boolean) {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: { authenticated, user: authenticated ? "user" : null },
    })
  );
}

// Stateful board mock: GET returns the current board, PUT replaces it. This
// simulates backend persistence so reload tests work.
export async function mockBoard(page: Page) {
  let board = structuredClone(seedBoard);
  await page.route("**/api/board", (route) => {
    if (route.request().method() === "PUT") {
      board = route.request().postDataJSON();
      return route.fulfill({ json: board });
    }
    return route.fulfill({ json: board });
  });
}
