import { describe, expect, it } from "vitest";

import {
  incomeInstallmentPlanSchema,
  installmentCountsSchema,
  installmentPlanSchema,
} from "./schema";

const validInput = {
  description: "Heladera",
  categoryId: "cat_1",
  currency: "ARS",
  accountId: "acc_1",
  notes: "",
  amount: "1200000.50",
  amountMode: "total",
  totalCuotas: 12,
  firstDate: "2026-10-15",
  cardOwnership: "borrowed",
};

const errorPaths = (input: Record<string, unknown>): string[] => {
  const result = installmentPlanSchema.safeParse(input);

  return result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
};

describe("installmentPlanSchema", () => {
  it("turns a valid purchase into the stored shape, with the total in minor units", () => {
    expect(installmentPlanSchema.safeParse(validInput).data).toEqual({
      description: "Heladera",
      categoryId: "cat_1",
      currency: "ARS",
      accountId: "acc_1",
      notes: null,
      totalCuotas: 12,
      totalAmount: 120000050,
      firstDate: "2026-10-15",
    });
  });

  describe("the ownership of the card", () => {
    it("is required: the purchase is paid with one of the user's cards or a borrowed one", () => {
      const withoutOwnership: Record<string, unknown> = { ...validInput };

      delete withoutOwnership.cardOwnership;

      expect(errorPaths(withoutOwnership)).toEqual(["cardOwnership"]);
      expect(errorPaths({ ...validInput, cardOwnership: "stolen" })).toEqual([
        "cardOwnership",
      ]);
    });

    it("does not travel into the stored shape", () => {
      expect(
        installmentPlanSchema.safeParse(validInput).data,
      ).not.toHaveProperty("cardOwnership");
    });
  });

  describe("with a borrowed card", () => {
    it("carries no card of the user's: nothing about cards is kept", () => {
      const result = installmentPlanSchema.safeParse({
        ...validInput,
        purchaseDate: "2026-10-10",
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty("cardId");
      expect(result.data).not.toHaveProperty("purchaseDate");
    });

    it("reads an empty card id as no card", () => {
      expect(
        installmentPlanSchema.safeParse({ ...validInput, cardId: "" }).success,
      ).toBe(true);
    });

    it("refuses a card id", () => {
      expect(errorPaths({ ...validInput, cardId: "card_1" })).toEqual([
        "cardId",
      ]);
    });
  });

  describe("with one of the user's cards", () => {
    const withCard = {
      ...validInput,
      cardOwnership: "own",
      cardId: "card_1",
      purchaseDate: "2026-10-10",
    };

    it("keeps the card and the day of the purchase next to the date of the first installment", () => {
      expect(installmentPlanSchema.safeParse(withCard).data).toMatchObject({
        cardId: "card_1",
        purchaseDate: "2026-10-10",
        firstDate: "2026-10-15",
      });
    });

    it("requires a card", () => {
      expect(
        errorPaths({ ...withCard, cardId: "", purchaseDate: "2026-10-10" }),
      ).toEqual(["cardId"]);

      const withoutCard: Record<string, unknown> = { ...withCard };

      delete withoutCard.cardId;
      expect(errorPaths(withoutCard)).toEqual(["cardId"]);
      expect(
        installmentPlanSchema.safeParse({ ...withCard, cardId: " " }).error
          ?.issues[0].message,
      ).toBe("Elegí una tarjeta.");
    });

    it("requires the day of the purchase, since the card's cycle starts from it", () => {
      expect(errorPaths({ ...withCard, purchaseDate: "" })).toEqual([
        "purchaseDate",
      ]);
      expect(errorPaths({ ...withCard, purchaseDate: "2026-02-31" })).toEqual([
        "purchaseDate",
      ]);

      const withoutDate: Record<string, unknown> = { ...withCard };

      delete withoutDate.purchaseDate;
      expect(errorPaths(withoutDate)).toEqual(["purchaseDate"]);
    });

    it("keeps the purchase inside the years the app can show", () => {
      expect(errorPaths({ ...withCard, purchaseDate: "1999-12-31" })).toEqual([
        "purchaseDate",
      ]);
    });

    it("trims the id of the card", () => {
      expect(
        installmentPlanSchema.safeParse({ ...withCard, cardId: " card_1 " })
          .data?.cardId,
      ).toBe("card_1");
    });
  });

  it("reads the amount as the amount of one installment when asked to", () => {
    const result = installmentPlanSchema.safeParse({
      ...validInput,
      amount: "100000.50",
      amountMode: "perInstallment",
    });

    expect(result.data?.totalAmount).toBe(120000600);
  });

  it("requires the account the purchase is paid from", () => {
    expect(errorPaths({ ...validInput, accountId: "" })).toEqual(["accountId"]);
  });

  it("keeps the account chosen with an own card: a card no longer forces anything", () => {
    expect(
      installmentPlanSchema.safeParse({
        ...validInput,
        cardOwnership: "own",
        cardId: "card_1",
        purchaseDate: "2026-10-10",
        accountId: "acc_cash",
      }).data?.accountId,
    ).toBe("acc_cash");
  });

  it("no longer outputs a medium", () => {
    expect(installmentPlanSchema.safeParse(validInput).data).not.toHaveProperty(
      "medium",
    );
  });

  it("trims the product and the notes, and keeps notes only when there are some", () => {
    const result = installmentPlanSchema.safeParse({
      ...validInput,
      description: "  Heladera  ",
      notes: "  Garantía 12 meses  ",
    });

    expect(result.data).toMatchObject({
      description: "Heladera",
      notes: "Garantía 12 meses",
    });
  });

  it("requires a product", () => {
    expect(errorPaths({ ...validInput, description: "   " })).toEqual([
      "description",
    ]);
  });

  it("leaves room in the description for the numbering of the installment", () => {
    expect(errorPaths({ ...validInput, description: "a".repeat(193) })).toEqual(
      ["description"],
    );
    expect(errorPaths({ ...validInput, description: "a".repeat(192) })).toEqual(
      [],
    );
  });

  it("requires a category", () => {
    expect(errorPaths({ ...validInput, categoryId: " " })).toEqual([
      "categoryId",
    ]);
  });

  it("rejects an unsupported currency", () => {
    expect(errorPaths({ ...validInput, currency: "XXX" })).toEqual([
      "currency",
    ]);
  });

  it.each([["abc"], [""], ["0"], ["0.00"], ["-5"], ["10.123"], ["10,50"]])(
    "rejects the amount %j",
    (amount) => {
      expect(errorPaths({ ...validInput, amount })).toEqual(["amount"]);
    },
  );

  it("rejects an amount whose total is beyond what can be stored", () => {
    expect(
      errorPaths({
        ...validInput,
        amount: "90071992547409.91",
        amountMode: "perInstallment",
      }),
    ).toEqual(["amount"]);
  });

  it("rejects an unknown amount mode", () => {
    expect(errorPaths({ ...validInput, amountMode: "half" })).toEqual([
      "amountMode",
    ]);
  });

  it.each([2, 12, 60])("accepts %i installments", (totalCuotas) => {
    expect(errorPaths({ ...validInput, totalCuotas })).toEqual([]);
  });

  it.each([[1], [0], [61], [2.5], ["12"], [null], [undefined]])(
    "rejects %j installments",
    (totalCuotas) => {
      expect(errorPaths({ ...validInput, totalCuotas })).toEqual([
        "totalCuotas",
      ]);
    },
  );

  it.each([
    ["2026-02-30"],
    ["15/10/2026"],
    [""],
    ["1999-12-31"],
    ["2100-01-01"],
  ])("rejects the first date %j", (firstDate) => {
    expect(errorPaths({ ...validInput, firstDate })).toEqual(["firstDate"]);
  });

  it("rejects a plan whose last installment falls beyond the months the app supports", () => {
    expect(
      errorPaths({ ...validInput, firstDate: "2099-12-15", totalCuotas: 2 }),
    ).toEqual(["firstDate"]);
    expect(
      errorPaths({ ...validInput, firstDate: "2099-11-15", totalCuotas: 2 }),
    ).toEqual([]);
  });

  it("ignores a user id and an id in the payload", () => {
    const result = installmentPlanSchema.safeParse({
      ...validInput,
      userId: "attacker",
      id: "plan_x",
    });

    expect(result.data).not.toHaveProperty("userId");
    expect(result.data).not.toHaveProperty("id");
  });

  it("refuses a purchase in a crypto currency, on the currency only: installments are legal tender", () => {
    expect(errorPaths({ ...validInput, currency: "USDC" })).toEqual([
      "currency",
    ]);
    expect(errorPaths({ ...validInput, currency: "USD" })).toEqual([]);
  });
});

describe("incomeInstallmentPlanSchema", () => {
  const validRepayment = {
    kind: "income",
    description: "Préstamo a Juan",
    categoryId: "cat_1",
    currency: "ARS",
    accountId: "acc_1",
    notes: " en mano ",
    amount: "600000.50",
    amountMode: "total",
    totalCuotas: 6,
    firstDate: "2026-10-15",
  };

  const repaymentErrorPaths = (input: Record<string, unknown>): string[] => {
    const result = incomeInstallmentPlanSchema.safeParse(input);

    return result.success
      ? []
      : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
  };

  it("turns a valid repayment into the stored shape, with the total in minor units and no card", () => {
    expect(incomeInstallmentPlanSchema.safeParse(validRepayment).data).toEqual({
      description: "Préstamo a Juan",
      categoryId: "cat_1",
      currency: "ARS",
      accountId: "acc_1",
      notes: "en mano",
      totalCuotas: 6,
      totalAmount: 60000050,
      firstDate: "2026-10-15",
    });
  });

  it("multiplies the amount of one installment when that is what was typed", () => {
    expect(
      incomeInstallmentPlanSchema.safeParse({
        ...validRepayment,
        amount: "100000",
        amountMode: "perInstallment",
      }).data?.totalAmount,
    ).toBe(60000000);
  });

  it("requires the kind to be income", () => {
    expect(repaymentErrorPaths({ ...validRepayment, kind: "expense" })).toEqual(
      ["kind"],
    );
    expect(
      incomeInstallmentPlanSchema.safeParse({
        ...validRepayment,
        kind: "income",
      }).success,
    ).toBe(true);
  });

  it("never carries a card, whatever came with the payload", () => {
    const result = incomeInstallmentPlanSchema.safeParse({
      ...validRepayment,
      cardOwnership: "own",
      cardId: "card_1",
      purchaseDate: "2026-10-10",
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("cardId");
    expect(result.data).not.toHaveProperty("purchaseDate");
    expect(result.data).not.toHaveProperty("cardOwnership");
    expect(result.data).not.toHaveProperty("kind");
  });

  it("keeps the account the money arrives in", () => {
    expect(
      incomeInstallmentPlanSchema.safeParse({
        ...validRepayment,
        accountId: "acc_cash",
      }).data?.accountId,
    ).toBe("acc_cash");
  });

  it("no longer outputs a medium, whatever came with the payload", () => {
    const result = incomeInstallmentPlanSchema.safeParse({
      ...validRepayment,
      medium: "CASH",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("accountId", "acc_1");
    expect(result.data).not.toHaveProperty("medium");
  });

  it("asks for the concept in its own words", () => {
    const result = incomeInstallmentPlanSchema.safeParse({
      ...validRepayment,
      description: "  ",
    });

    expect(result.error?.issues[0].message).toBe("El concepto es obligatorio.");
  });

  it("leaves room for the installment suffix in the concept", () => {
    expect(
      repaymentErrorPaths({ ...validRepayment, description: "a".repeat(192) }),
    ).toEqual([]);
    expect(
      repaymentErrorPaths({ ...validRepayment, description: "a".repeat(193) }),
    ).toEqual(["description"]);
  });

  it.each([
    ["a category", { categoryId: " " }, "categoryId"],
    ["a supported currency", { currency: "XXX" }, "currency"],
    ["a valid amount", { amount: "abc" }, "amount"],
    ["a positive amount", { amount: "0" }, "amount"],
    ["2 to 60 installments", { totalCuotas: 1 }, "totalCuotas"],
    ["2 to 60 installments", { totalCuotas: 61 }, "totalCuotas"],
    ["a valid first date", { firstDate: "2026-02-31" }, "firstDate"],
    ["an account", { accountId: "" }, "accountId"],
  ])("requires %s", (_name, patch, path) => {
    expect(repaymentErrorPaths({ ...validRepayment, ...patch })).toEqual([
      path,
    ]);
  });

  it("refuses a last installment beyond the years the app can show", () => {
    expect(
      repaymentErrorPaths({
        ...validRepayment,
        firstDate: "2099-12-15",
        totalCuotas: 2,
      }),
    ).toEqual(["firstDate"]);
  });

  it("ignores a user id and an id in the payload", () => {
    const result = incomeInstallmentPlanSchema.safeParse({
      ...validRepayment,
      userId: "attacker",
      id: "plan_x",
    });

    expect(result.data).not.toHaveProperty("userId");
    expect(result.data).not.toHaveProperty("id");
  });

  it("refuses a repayment in a crypto currency, on the currency only", () => {
    expect(repaymentErrorPaths({ ...validRepayment, currency: "BTC" })).toEqual(
      ["currency"],
    );
    expect(repaymentErrorPaths(validRepayment)).toEqual([]);
  });
});

describe("installmentCountsSchema", () => {
  it("accepts the counts of the plans the user changed", () => {
    expect(
      installmentCountsSchema.safeParse([
        { planId: " plan_1 ", count: 2 },
        { planId: "plan_2", count: 0 },
      ]).data,
    ).toEqual([
      { planId: "plan_1", count: 2 },
      { planId: "plan_2", count: 0 },
    ]);
  });

  it("accepts an empty list", () => {
    expect(installmentCountsSchema.safeParse([]).data).toEqual([]);
  });

  it.each([
    [{ planId: "", count: 1 }],
    [{ planId: "plan_1", count: -1 }],
    [{ planId: "plan_1", count: 1.5 }],
    [{ planId: "plan_1", count: 61 }],
    [{ planId: "plan_1", count: "2" }],
    [{ planId: "plan_1" }],
  ])("rejects the entry %j", (entry) => {
    expect(installmentCountsSchema.safeParse([entry]).success).toBe(false);
  });

  it("rejects something that is not a list", () => {
    expect(installmentCountsSchema.safeParse("nope").success).toBe(false);
  });

  it("rejects more entries than a person could have", () => {
    const tooMany = Array.from({ length: 201 }, (_, index) => ({
      planId: `plan_${index}`,
      count: 1,
    }));

    expect(installmentCountsSchema.safeParse(tooMany).success).toBe(false);
  });
});
