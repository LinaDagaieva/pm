# Frontend

A pure frontend-only demo of the Kanban board, built with Next.js (App Router) and React. State is in-memory only; there is no persistence, auth, or backend wiring yet. Later plan parts statically export this app and connect it to the FastAPI backend.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 (via `@tailwindcss/postcss`), CSS variables for the color scheme in `src/app/globals.css`
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `clsx` for conditional class names
- Tests: Vitest + Testing Library (unit), Playwright (e2e)

## Layout

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) fonts, sets metadata
- `src/app/page.tsx` - home route, renders `<KanbanBoard />`
- `src/app/globals.css` - Tailwind import, color-scheme CSS variables, font helpers
- `src/lib/kanban.ts` - data model and pure board logic
- `src/components/` - UI components
- `src/test/setup.ts` - Vitest setup (jest-dom matchers)
- `tests/kanban.spec.ts` - Playwright e2e spec

## Data model (`src/lib/kanban.ts`)

```ts
type Card = { id: string; title: string; details: string };
type Column = { id: string; title: string; cardIds: string[] };
type BoardData = { columns: Column[]; cards: Record<string, Card> };
```

- `initialData` - seed board: 5 fixed columns (Backlog, Discovery, In Progress, Review, Done) and 8 cards. Columns reference cards by id; cards stored in a lookup map.
- `moveCard(columns, activeId, overId)` - pure reducer for drag/drop. Handles reordering within a column and moving across columns; returns columns unchanged on no-op. This is the core logic exercised by unit tests.
- `createId(prefix)` - generates ids like `card-<rand><time>`.

## Components (`src/components/`)

- `KanbanBoard.tsx` - top-level client component (`"use client"`). Owns `board` state (seeded from `initialData`) and `activeCardId`. Wires `DndContext` (PointerSensor, `closestCorners`), and holds handlers: `handleDragStart`, `handleDragEnd` (calls `moveCard`), `handleRenameColumn`, `handleAddCard`, `handleDeleteCard`. Renders the header and a 5-column grid plus a `DragOverlay`.
- `KanbanColumn.tsx` - a droppable column (`useDroppable`). Renders an editable title input (rename on change), a card count, a `SortableContext` of cards, an empty-state placeholder, and `NewCardForm`. Has `data-testid="column-<id>"`.
- `KanbanCard.tsx` - a sortable card (`useSortable`). Shows title, details, and a Remove button. Has `data-testid="card-<id>"`.
- `KanbanCardPreview.tsx` - static card visual used inside `DragOverlay` during a drag.
- `NewCardForm.tsx` - collapsible add-card form (title required, details optional).

State flows top-down from `KanbanBoard`; all mutations happen there via callbacks. Components are presentational apart from dnd hooks.

## Color scheme

Defined as CSS variables in `globals.css`: `--accent-yellow #ecad0a`, `--primary-blue #209dd7`, `--secondary-purple #753991`, `--navy-dark #032147`, `--gray-text #888888`, plus surface/stroke/shadow tokens.

## Commands

```bash
npm install
npm run dev            # next dev
npm run build          # next build
npm run lint           # eslint
npm run test:unit      # vitest run
npm run test:e2e       # playwright test (starts dev server on 127.0.0.1:3000)
npm run test:all       # unit then e2e
```

## Tests

- `src/lib/kanban.test.ts` - unit tests for `moveCard` / board logic
- `src/components/KanbanBoard.test.tsx` - component tests (render, add/remove, interactions)
- `tests/kanban.spec.ts` - Playwright e2e against the dev server (`vitest.config.ts` excludes `tests/`)

## Notes for later parts

- No persistence today: refreshing resets to `initialData`. Backend wiring (Part 7) replaces the in-memory seed with API reads/writes against `BoardData`-shaped JSON.
- Auth gate (`App.tsx`): on mount it calls `getSession()` (`src/lib/auth.ts`); shows `Login.tsx` when anonymous, the board (with a Log out control) when authenticated. `page.tsx` renders `<App />`.
- Configured for static export (`output: "export"` in `next.config.ts`): `npm run build` emits `frontend/out`, which the Docker build copies into the backend image's static dir and FastAPI serves at `/`.
