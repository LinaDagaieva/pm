import { createId, moveCard, type Column } from "@/lib/kanban";

describe("createId", () => {
  it("generates unique ids on repeated calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId("card")));
    expect(ids.size).toBe(100);
  });

  it("includes the given prefix", () => {
    expect(createId("card")).toMatch(/^card-/);
    expect(createId("col")).toMatch(/^col-/);
  });
});

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("returns original columns when moving card to same position", () => {
    const result = moveCard(baseColumns, "card-1", "card-1");
    expect(result).toBe(baseColumns);
  });

  it("returns original columns when overId does not exist", () => {
    const result = moveCard(baseColumns, "card-1", "nonexistent");
    expect(result).toBe(baseColumns);
  });

  it("returns original columns when activeId does not exist", () => {
    const result = moveCard(baseColumns, "nonexistent", "card-1");
    expect(result).toBe(baseColumns);
  });

  it("moves a card into an empty column", () => {
    const emptyColumns: Column[] = [
      { id: "col-a", title: "A", cardIds: [] },
      { id: "col-b", title: "B", cardIds: ["card-1"] },
    ];
    const result = moveCard(emptyColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual([]);
  });
});
