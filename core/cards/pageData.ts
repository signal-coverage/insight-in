import { listBankChoices } from "@/core/banks/choices";

import { listCards } from "./service";

// Everything the cards page needs: the user's cards with what each has used of its caps this month,
// and the active banks a new card can belong to. Both reads start together.
export const loadCardsPageData = async (userId: string) => {
  const [cards, banks] = await Promise.all([
    listCards(userId),
    listBankChoices(userId),
  ]);

  return { cards, banks };
};
