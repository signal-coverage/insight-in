import { describe, expect, it } from "vitest";

import { digitsOnly } from "./utils";

describe("digitsOnly", () => {
  it("keeps the digits and drops everything else", () => {
    expect(digitsOnly("12a4-b", 4)).toBe("124");
    expect(digitsOnly("1 2 3 4", 4)).toBe("1234");
    expect(digitsOnly("abc", 4)).toBe("");
  });

  it("keeps leading zeros", () => {
    expect(digitsOnly("0042", 4)).toBe("0042");
  });

  it("cuts what is longer than the limit, as a paste would be", () => {
    expect(digitsOnly("4111 1111 1111 1234", 4)).toBe("4111");
  });

  it("only keeps the digits of the Latin alphabet", () => {
    expect(digitsOnly("١٢٣٤12", 4)).toBe("12");
  });
});
