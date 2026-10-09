import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ listCards: vi.fn() }));
const banks = vi.hoisted(() => ({ listBankChoices: vi.fn() }));

vi.mock("./service", () => service);
vi.mock("@/core/banks/choices", () => banks);

import { loadCardsPageData } from "./pageData";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadCardsPageData", () => {
  it("reads the cards of the user, with their usage, and the banks a new card can belong to", async () => {
    const cards = [{ id: "card_1" }];
    const choices = [{ id: "bank_1", name: "Banco Galicia" }];

    service.listCards.mockResolvedValue(cards);
    banks.listBankChoices.mockResolvedValue(choices);

    await expect(loadCardsPageData("user_1")).resolves.toEqual({
      cards,
      banks: choices,
    });
    expect(service.listCards).toHaveBeenCalledWith("user_1");
    expect(banks.listBankChoices).toHaveBeenCalledWith("user_1");
  });
});
