import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { accountInputSchema, createAccountInputSchema } from "./schema";

const messagesOf = (schema: z.ZodType, input: unknown): string[] => {
  const result = schema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("accountInputSchema", () => {
  it("trims the name and keeps a supported currency", () => {
    expect(
      accountInputSchema.parse({ name: "  Caja de ahorro  ", currency: "ARS" }),
    ).toEqual({ name: "Caja de ahorro", currency: "ARS" });
  });

  it("accepts any supported ISO currency", () => {
    expect(
      accountInputSchema.safeParse({ name: "Dólares", currency: "USD" })
        .success,
    ).toBe(true);
  });

  it("refuses a currency the app does not support, and one in lower case", () => {
    expect(
      messagesOf(accountInputSchema, { name: "A", currency: "ZZZ" }),
    ).toEqual(["Selecciona una moneda compatible."]);
    expect(
      messagesOf(accountInputSchema, { name: "A", currency: "ars" }),
    ).toEqual(["Selecciona una moneda compatible."]);
  });

  it("requires a currency", () => {
    expect(messagesOf(accountInputSchema, { name: "A" })).toEqual([
      "La moneda es obligatoria.",
    ]);
  });

  it("refuses an empty name and a name of only spaces", () => {
    expect(
      messagesOf(accountInputSchema, { name: "", currency: "ARS" }),
    ).toEqual(["El nombre es obligatorio."]);
    expect(
      messagesOf(accountInputSchema, { name: "  ", currency: "ARS" }),
    ).toEqual(["El nombre es obligatorio."]);
  });

  it("accepts 40 characters and refuses 41", () => {
    expect(
      messagesOf(accountInputSchema, { name: "a".repeat(40), currency: "ARS" }),
    ).toEqual([]);
    expect(
      messagesOf(accountInputSchema, { name: "a".repeat(41), currency: "ARS" }),
    ).toEqual(["El nombre admite como máximo 40 caracteres."]);
  });

  it("does not take a bank: an edit can never move an account to another bank", () => {
    expect(
      accountInputSchema.parse({
        name: "A",
        currency: "ARS",
        bankId: "bank_2",
      }),
    ).toEqual({ name: "A", currency: "ARS" });
  });

  it("accepts a crypto currency: whether the bank may hold it is the service's call", () => {
    expect(
      accountInputSchema.parse({ name: "USDC", currency: "USDC" }),
    ).toEqual({ name: "USDC", currency: "USDC" });
  });
});

describe("createAccountInputSchema", () => {
  it("takes the bank the account is created in", () => {
    expect(
      createAccountInputSchema.parse({
        bankId: " bank_1 ",
        name: "Caja de ahorro",
        currency: "ARS",
      }),
    ).toEqual({ bankId: "bank_1", name: "Caja de ahorro", currency: "ARS" });
  });

  it("requires a bank", () => {
    expect(
      messagesOf(createAccountInputSchema, { name: "A", currency: "ARS" }),
    ).toEqual(["Elegí un banco."]);
    expect(
      messagesOf(createAccountInputSchema, {
        bankId: "  ",
        name: "A",
        currency: "ARS",
      }),
    ).toEqual(["Elegí un banco."]);
  });

  it("strips fields it does not know", () => {
    expect(
      createAccountInputSchema.parse({
        bankId: "bank_1",
        name: "A",
        currency: "ARS",
        userId: "attacker",
        archivedAt: "x",
      }),
    ).toEqual({ bankId: "bank_1", name: "A", currency: "ARS" });
  });
});
