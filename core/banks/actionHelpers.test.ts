import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { z } from "zod";

import { parseForm } from "./actionHelpers";

const schema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
});

const formOf = (values: Record<string, string>) => {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

// A loose schema keeps unknown keys, so a key that leaked past the whitelist would show in the data.
const looseSchema = z.looseObject({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
});

describe("parseForm", () => {
  it("reads only the listed fields and returns the validated data", () => {
    const parsed = parseForm(
      looseSchema,
      formOf({ name: " Galicia ", userId: "attacker" }),
      ["name"],
    );

    expect(parsed).toEqual({ data: { name: "Galicia" } });
    expect(Object.keys((parsed as { data: object }).data)).toEqual(["name"]);
  });

  it("hands the schema only the listed fields", () => {
    const received: unknown[] = [];
    const recording = z.unknown().transform((input) => {
      received.push(input);

      return input;
    });

    parseForm(recording, formOf({ name: "Galicia", userId: "attacker" }), [
      "name",
    ]);

    expect(received).toEqual([{ name: "Galicia" }]);
  });

  it("returns the field failure the UI shows when the form is invalid", () => {
    expect(parseForm(schema, formOf({ name: "  " }), ["name"])).toEqual({
      error: {
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { name: ["El nombre es obligatorio."] },
      },
    });
  });
});
