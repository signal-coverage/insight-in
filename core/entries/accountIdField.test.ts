import { describe, expect, it } from "vitest";

import { accountIdField } from "./fields";

describe("accountIdField", () => {
  it("trims the id it receives", () => {
    expect(accountIdField.parse(" acc_1 ")).toBe("acc_1");
  });

  it("requires an account: missing, empty or blank", () => {
    for (const value of [undefined, "", "   "]) {
      const result = accountIdField.safeParse(value);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Elegí una cuenta.");
    }
  });
});
