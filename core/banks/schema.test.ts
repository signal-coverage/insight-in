import { describe, expect, it } from "vitest";

import { bankInputSchema } from "./schema";

const messages = (input: unknown): string[] => {
  const result = bankInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("bankInputSchema", () => {
  it("trims the name and keeps the kind", () => {
    expect(
      bankInputSchema.parse({ name: "  Banco Galicia  ", kind: "ENTITY" }),
    ).toEqual({ name: "Banco Galicia", kind: "ENTITY" });
  });

  it("keeps the casing the user typed", () => {
    expect(
      bankInputSchema.parse({ name: "mercado PAGO", kind: "WALLET" }),
    ).toEqual({ name: "mercado PAGO", kind: "WALLET" });
  });

  it("refuses an empty name, a name of only spaces and a missing name", () => {
    expect(messages({ name: "", kind: "ENTITY" })).toEqual([
      "El nombre es obligatorio.",
    ]);
    expect(messages({ name: "   ", kind: "ENTITY" })).toEqual([
      "El nombre es obligatorio.",
    ]);
    expect(messages({ kind: "ENTITY" })).toEqual(["El nombre es obligatorio."]);
  });

  it("accepts 40 characters and refuses 41", () => {
    expect(messages({ name: "a".repeat(40), kind: "ENTITY" })).toEqual([]);
    expect(messages({ name: "a".repeat(41), kind: "ENTITY" })).toEqual([
      "El nombre admite como máximo 40 caracteres.",
    ]);
  });

  it("counts the length after trimming", () => {
    expect(messages({ name: ` ${"a".repeat(40)} `, kind: "ENTITY" })).toEqual(
      [],
    );
  });

  it("requires a known kind: a missing one never turns a wallet into an entity", () => {
    expect(messages({ name: "Galicia" })).toEqual(["Elegí el tipo de banco."]);
    expect(messages({ name: "Galicia", kind: "CRYPTO" })).toEqual([
      "Elegí el tipo de banco.",
    ]);
    expect(messages({ name: "Galicia", kind: "WALLET" })).toEqual([]);
  });

  it("strips fields it does not know, so an owner or an archive date can never ride along", () => {
    expect(
      bankInputSchema.parse({
        name: "A",
        kind: "ENTITY",
        userId: "attacker",
        archivedAt: "x",
      }),
    ).toEqual({ name: "A", kind: "ENTITY" });
  });
});
