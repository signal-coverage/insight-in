import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// There is no database in the unit tests, so the constraints that decide the rules of this feature
// (a name is unique per user for a bank and per bank for an account; an account always has a bank
// that cannot be deleted under it; archive instead of delete) are pinned on the schema text itself.
const SCHEMA = readFileSync(join(__dirname, "schema.prisma"), "utf8");

const modelBlock = (name: string): string => {
  const match = SCHEMA.match(
    new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"),
  );

  if (!match) {
    throw new Error(`model ${name} is not in schema.prisma`);
  }

  return match[1];
};

describe("model Bank", () => {
  const bank = modelBlock("Bank");

  it("belongs to a Clerk user and is named", () => {
    expect(bank).toMatch(/userId\s+String/);
    expect(bank).toMatch(/name\s+String/);
  });

  it("has a name that is unique per user", () => {
    expect(bank).toContain("@@unique([userId, name])");
  });

  it("is archived with a date, never deleted", () => {
    expect(bank).toMatch(/archivedAt\s+DateTime\?/);
  });

  it("owns its accounts", () => {
    expect(bank).toMatch(/accounts\s+Account\[\]/);
  });
});

describe("model Account", () => {
  const account = modelBlock("Account");

  it("belongs to a Clerk user and holds exactly one currency", () => {
    expect(account).toMatch(/userId\s+String/);
    expect(account).toMatch(/currency\s+String/);
  });

  it("belongs to a bank that cannot be deleted while it has accounts", () => {
    expect(account).toMatch(
      /bank\s+Bank\s+@relation\(fields: \[bankId\], references: \[id\], onDelete: Restrict\)/,
    );
  });

  it("has a name that is unique per bank, not per user", () => {
    expect(account).toContain("@@unique([bankId, name])");
    expect(account).not.toContain("@@unique([userId, name])");
  });

  it("is archived with a date, never deleted", () => {
    expect(account).toMatch(/archivedAt\s+DateTime\?/);
  });
});

// Stage 2: every movement and every opening amount requires an account that cannot be deleted
// while anything points at it.
const ACCOUNT_RELATION =
  /account\s+Account\s+@relation\(fields: \[accountId\], references: \[id\], onDelete: Restrict\)/;

describe.each([
  "Income",
  "RecurringIncome",
  "Expense",
  "RecurringExpense",
  "InstallmentPlan",
  "OpeningBalance",
])("model %s and its account", (name) => {
  const model = modelBlock(name);

  it("requires an account that cannot be deleted under it", () => {
    expect(model).toMatch(/accountId\s+String\s/);
    expect(model).toMatch(ACCOUNT_RELATION);
  });

  it("indexes the account, so the movements of an account are found without a scan", () => {
    expect(model).toContain("@@index([accountId])");
  });
});

describe("model Account and its movements", () => {
  const account = modelBlock("Account");

  it("lists everything that points at it", () => {
    expect(account).toMatch(/incomes\s+Income\[\]/);
    expect(account).toMatch(/expenses\s+Expense\[\]/);
    expect(account).toMatch(/recurringIncomes\s+RecurringIncome\[\]/);
    expect(account).toMatch(/recurringExpenses\s+RecurringExpense\[\]/);
    expect(account).toMatch(/installmentPlans\s+InstallmentPlan\[\]/);
    expect(account).toMatch(/openingBalances\s+OpeningBalance\[\]/);
  });
});

describe("model OpeningBalance per account", () => {
  const opening = modelBlock("OpeningBalance");

  it("keeps one amount per account and user", () => {
    expect(opening).toContain("@@unique([userId, accountId])");
  });

  it("has no currency nor medium of its own: the account has the currency", () => {
    expect(opening).not.toMatch(/\bcurrency\b/);
    expect(opening).not.toMatch(/\bmedium\b/);
    expect(opening).not.toContain("@@unique([userId, currency, medium])");
  });
});

describe("the payment medium", () => {
  it("is gone from every model, and its enum too", () => {
    expect(SCHEMA).not.toMatch(/\bmedium\b/);
    expect(SCHEMA).not.toContain("PaymentMedium");
  });
});

const withoutComments = (block: string): string =>
  block.replace(/\/\/.*$/gm, "");

describe("model Transfer", () => {
  const transfer = withoutComments(modelBlock("Transfer"));

  it("belongs to a Clerk user", () => {
    expect(transfer).toMatch(/userId\s+String/);
  });

  it("leaves one account and enters another, neither of which can be deleted under it", () => {
    expect(transfer).toMatch(
      /fromAccount\s+Account\s+@relation\("TransferFrom", fields: \[fromAccountId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(transfer).toMatch(
      /toAccount\s+Account\s+@relation\("TransferTo", fields: \[toAccountId\], references: \[id\], onDelete: Restrict\)/,
    );
  });

  it("keeps the amount in minor units and the day as a calendar date", () => {
    expect(transfer).toMatch(/amount\s+BigInt/);
    expect(transfer).toMatch(/date\s+DateTime\s+@db\.Date/);
  });

  it("has optional notes", () => {
    expect(transfer).toMatch(/notes\s+String\?/);
  });

  it("has no currency of its own: it is the currency of its accounts", () => {
    expect(transfer).not.toMatch(/\bcurrency\b/);
  });

  it("indexes the user's list by date and each side of the transfer", () => {
    expect(transfer).toContain("@@index([userId, date(sort: Desc)])");
    expect(transfer).toContain("@@index([fromAccountId])");
    expect(transfer).toContain("@@index([toAccountId])");
  });
});

describe("model Account and its transfers", () => {
  it("lists the transfers that leave it and the ones that enter it", () => {
    const account = modelBlock("Account");

    expect(account).toMatch(
      /transfersOut\s+Transfer\[\]\s+@relation\("TransferFrom"\)/,
    );
    expect(account).toMatch(
      /transfersIn\s+Transfer\[\]\s+@relation\("TransferTo"\)/,
    );
  });
});

describe("the transfers migration", () => {
  const MIGRATION = readFileSync(
    join(__dirname, "migrations", "20261007120000_transfers", "migration.sql"),
    "utf8",
  );

  it("only adds: nothing that exists is dropped, renamed, truncated, updated or deleted", () => {
    expect(MIGRATION).not.toMatch(/\b(DROP|TRUNCATE|RENAME)\b/i);
    expect(MIGRATION).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it("alters no table but the new one", () => {
    const altered = [...MIGRATION.matchAll(/ALTER TABLE "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(altered.length).toBeGreaterThan(0);
    expect(new Set(altered)).toEqual(new Set(["Transfer"]));
  });

  it("restricts both foreign keys to accounts", () => {
    expect(MIGRATION.match(/ON DELETE RESTRICT/g)).toHaveLength(2);
  });

  it("checks what Prisma cannot express: a positive amount and two different accounts", () => {
    expect(MIGRATION).toContain('CHECK ("amount" > 0)');
    expect(MIGRATION).toContain('CHECK ("fromAccountId" <> "toAccountId")');
  });
});

const enumBlock = (name: string): string => {
  const match = SCHEMA.match(
    new RegExp(`^enum ${name} \\{([\\s\\S]*?)^\\}`, "m"),
  );

  if (!match) {
    throw new Error(`enum ${name} is not in schema.prisma`);
  }

  return match[1];
};

describe("enum CardKind", () => {
  it("has exactly the two kinds: credit, and debit (which covers prepaid)", () => {
    expect(
      withoutComments(enumBlock("CardKind")).split(/\s+/).filter(Boolean),
    ).toEqual(["CREDIT", "DEBIT"]);
  });
});

describe("model Card", () => {
  const card = withoutComments(modelBlock("Card"));

  it("has a kind", () => {
    expect(card).toMatch(/kind\s+CardKind\s/);
  });

  it("belongs to a bank that cannot be deleted under it", () => {
    expect(card).toMatch(/bankId\s+String\s/);
    expect(card).toMatch(
      /bank\s+Bank\s+@relation\(fields: \[bankId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(card).toContain("@@index([bankId])");
  });

  it("keeps the cycle and the limit mode optional: only a credit card has them", () => {
    expect(card).toMatch(/closingDay\s+Int\?/);
    expect(card).toMatch(/dueDay\s+Int\?/);
    expect(card).toMatch(/limitMode\s+CardLimitMode\?/);
  });

  it("has no currency nor cap of its own: the caps are per currency, in CardLimit", () => {
    expect(card).not.toMatch(/\bcurrency\b/);
    expect(card).not.toMatch(/\blimitAmount\b/);
    expect(card).toMatch(/limits\s+CardLimit\[\]/);
  });

  it("keeps one card per brand and last four digits of a user, and its plans and expenses", () => {
    expect(card).toContain("@@unique([userId, last4, brand])");
    expect(card).toMatch(/plans\s+InstallmentPlan\[\]/);
    expect(card).toMatch(/expenses\s+Expense\[\]/);
  });
});

describe("model CardLimit", () => {
  const limit = withoutComments(modelBlock("CardLimit"));

  it("belongs to a card and goes away with it", () => {
    expect(limit).toMatch(
      /card\s+Card\s+@relation\(fields: \[cardId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it("is an amount in minor units of one currency, once per currency of a card", () => {
    expect(limit).toMatch(/currency\s+String/);
    expect(limit).toMatch(/amount\s+BigInt/);
    expect(limit).toContain("@@unique([cardId, currency])");
  });
});

describe("model Bank and its cards", () => {
  it("lists the cards that belong to it", () => {
    expect(withoutComments(modelBlock("Bank"))).toMatch(/cards\s+Card\[\]/);
  });
});

describe("the card kinds and limits migration", () => {
  const MIGRATION = readFileSync(
    join(
      __dirname,
      "migrations",
      "20261007180000_card_kinds_and_limits",
      "migration.sql",
    ),
    "utf8",
  );

  it("drops exactly the two columns that moved to CardLimit, and nothing else", () => {
    const dropped = [...MIGRATION.matchAll(/DROP COLUMN "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(dropped).toEqual(["currency", "limitAmount"]);
    expect(MIGRATION).not.toMatch(/DROP\s+(TABLE|TYPE|INDEX|CONSTRAINT)/i);
    expect(MIGRATION).not.toMatch(/\b(TRUNCATE|RENAME)\b/i);
    expect(MIGRATION).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it("alters only the card and its new caps table", () => {
    const altered = [...MIGRATION.matchAll(/ALTER TABLE "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(altered.length).toBeGreaterThan(0);
    expect(new Set(altered)).toEqual(new Set(["Card", "CardLimit"]));
  });

  it("restricts the bank and cascades the caps", () => {
    expect(MIGRATION).toMatch(
      /"Card_bankId_fkey" FOREIGN KEY \("bankId"\) REFERENCES "Bank"\("id"\) ON DELETE RESTRICT/,
    );
    expect(MIGRATION).toMatch(
      /"CardLimit_cardId_fkey" FOREIGN KEY \("cardId"\) REFERENCES "Card"\("id"\) ON DELETE CASCADE/,
    );
  });

  it("checks what Prisma cannot express: a positive cap and the fields of each kind", () => {
    expect(MIGRATION).toContain('CHECK ("amount" > 0)');
    expect(MIGRATION).toContain(
      `("kind" = 'CREDIT' AND "closingDay" IS NOT NULL AND "dueDay" IS NOT NULL AND "limitMode" IS NOT NULL)`,
    );
    expect(MIGRATION).toContain(
      `("kind" = 'DEBIT' AND "closingDay" IS NULL AND "dueDay" IS NULL AND "limitMode" IS NULL)`,
    );
  });
});

describe("enum BankKind", () => {
  it("has exactly the two kinds: a bank entity and a virtual wallet", () => {
    expect(
      withoutComments(enumBlock("BankKind")).split(/\s+/).filter(Boolean),
    ).toEqual(["ENTITY", "WALLET"]);
  });
});

describe("model Bank and its kind", () => {
  it("has a kind, and a bank starts as an entity", () => {
    expect(withoutComments(modelBlock("Bank"))).toMatch(
      /kind\s+BankKind\s+@default\(ENTITY\)/,
    );
  });
});

describe("the bank kinds migration", () => {
  const MIGRATION = withoutSqlComments(
    readFileSync(
      join(
        __dirname,
        "migrations",
        "20261008120000_bank_kinds",
        "migration.sql",
      ),
      "utf8",
    ),
  );

  it("only adds: nothing that exists is dropped, renamed, truncated, updated or deleted", () => {
    expect(MIGRATION).not.toMatch(/\b(DROP|TRUNCATE|RENAME)\b/i);
    expect(MIGRATION).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it("alters the bank and nothing else", () => {
    const altered = [...MIGRATION.matchAll(/ALTER TABLE "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(altered).toEqual(["Bank"]);
  });

  it("creates the kind type and fills every existing bank as an entity through the column default", () => {
    expect(MIGRATION).toContain(
      `CREATE TYPE "BankKind" AS ENUM ('ENTITY', 'WALLET');`,
    );
    expect(MIGRATION).toContain(
      `ADD COLUMN     "kind" "BankKind" NOT NULL DEFAULT 'ENTITY'`,
    );
  });
});

function withoutSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}
