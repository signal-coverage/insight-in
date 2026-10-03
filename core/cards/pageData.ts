import { listCards } from "./service";

// Everything the cards page needs: the user's cards with what each has used of its cap this month.
export const loadCardsPageData = async (userId: string) => ({
  cards: await listCards(userId),
});
