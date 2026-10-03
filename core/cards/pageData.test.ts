import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ listCards: vi.fn() }));

vi.mock("./service", () => service);

import { loadCardsPageData } from "./pageData";

beforeEach(() => {
  service.listCards.mockReset();
});

describe("loadCardsPageData", () => {
  it("reads the cards of the user, with their usage", async () => {
    const cards = [{ id: "card_1" }];

    service.listCards.mockResolvedValue(cards);

    await expect(loadCardsPageData("user_1")).resolves.toEqual({ cards });
    expect(service.listCards).toHaveBeenCalledWith("user_1");
  });
});
