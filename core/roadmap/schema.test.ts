import { describe, expect, it } from "vitest";

import { createItemSchema, moveItemSchema, updateItemSchema } from "./schema";

describe("updateItemSchema", () => {
  it("trims the title and keeps a description", () => {
    expect(
      updateItemSchema.parse({ title: "  Dark mode  ", description: " Hoy " }),
    ).toEqual({ title: "Dark mode", description: "Hoy" });
  });

  it("turns a missing or blank description into null", () => {
    expect(updateItemSchema.parse({ title: "A" }).description).toBeNull();
    expect(
      updateItemSchema.parse({ title: "A", description: "   " }).description,
    ).toBeNull();
  });

  it("requires a title", () => {
    const result = updateItemSchema.safeParse({ title: "   " });

    expect(result.success).toBe(false);
    expect(
      !result.success && result.error.issues.map((issue) => issue.message),
    ).toEqual(["El título es obligatorio."]);
  });

  it("requires the title to be there at all", () => {
    expect(updateItemSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a title of 120 characters and refuses one of 121", () => {
    expect(updateItemSchema.safeParse({ title: "a".repeat(120) }).success).toBe(
      true,
    );

    const result = updateItemSchema.safeParse({ title: "a".repeat(121) });

    expect(result.success).toBe(false);
    expect(
      !result.success && result.error.issues.map((issue) => issue.message),
    ).toEqual(["El título no puede superar los 120 caracteres."]);
  });

  it("accepts a description of 1000 characters and refuses one of 1001", () => {
    expect(
      updateItemSchema.safeParse({ title: "A", description: "b".repeat(1000) })
        .success,
    ).toBe(true);

    const result = updateItemSchema.safeParse({
      title: "A",
      description: "b".repeat(1001),
    });

    expect(result.success).toBe(false);
    expect(
      !result.success && result.error.issues.map((issue) => issue.message),
    ).toEqual(["La descripción no puede superar los 1000 caracteres."]);
  });

  it("strips fields it does not know, so an owner or a status can never ride along", () => {
    const parsed = updateItemSchema.parse({
      title: "A",
      userId: "attacker",
      status: "DONE",
    });

    expect(parsed).toEqual({ title: "A", description: null });
  });
});

describe("createItemSchema", () => {
  it("takes the column the card is created in", () => {
    expect(createItemSchema.parse({ title: "A", status: "TODO" })).toEqual({
      title: "A",
      description: null,
      status: "TODO",
      index: undefined,
    });
  });

  it("refuses a column that does not exist", () => {
    const result = createItemSchema.safeParse({ title: "A", status: "DOING" });

    expect(result.success).toBe(false);
    expect(
      !result.success && result.error.issues.map((issue) => issue.message),
    ).toEqual(["Elegí una columna válida."]);
  });

  it("reads the place as digits and ignores a blank one", () => {
    expect(
      createItemSchema.parse({ title: "A", status: "IDEA", index: "3" }).index,
    ).toBe(3);
    expect(
      createItemSchema.parse({ title: "A", status: "IDEA", index: "" }).index,
    ).toBeUndefined();
  });

  it("refuses a place that is not a whole number", () => {
    expect(
      createItemSchema.safeParse({ title: "A", status: "IDEA", index: "-1" })
        .success,
    ).toBe(false);
    expect(
      createItemSchema.safeParse({ title: "A", status: "IDEA", index: "1.5" })
        .success,
    ).toBe(false);
  });
});

describe("moveItemSchema", () => {
  it("accepts an id, a column and a place", () => {
    expect(moveItemSchema.parse({ id: "x", status: "DONE", index: 2 })).toEqual(
      { id: "x", status: "DONE", index: 2 },
    );
  });

  it.each([
    ["no id", { status: "DONE", index: 0 }],
    ["an empty id", { id: "", status: "DONE", index: 0 }],
    ["an id that is not text", { id: 5, status: "DONE", index: 0 }],
    ["an unknown column", { id: "x", status: "DOING", index: 0 }],
    ["a negative place", { id: "x", status: "DONE", index: -1 }],
    ["a fractional place", { id: "x", status: "DONE", index: 0.5 }],
    ["a place that is not a number", { id: "x", status: "DONE", index: "1" }],
    ["an absurd place", { id: "x", status: "DONE", index: 1_000_000 }],
    ["nothing at all", undefined],
  ])("refuses %s", (_name, input) => {
    expect(moveItemSchema.safeParse(input).success).toBe(false);
  });

  it("strips fields it does not know", () => {
    expect(
      moveItemSchema.parse({ id: "x", status: "DONE", index: 0, userId: "y" }),
    ).toEqual({ id: "x", status: "DONE", index: 0 });
  });
});
