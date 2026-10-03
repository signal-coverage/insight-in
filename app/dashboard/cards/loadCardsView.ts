import { toCardRows } from "@/components/Cards/utils";
import { loadCardsPageData } from "@/core/cards/pageData";

// Starts loading everything the page needs and returns immediately, without awaiting it. The page
// hands the promise straight to the client component, so the page's structure renders at once and
// only the table waits for its data.
//
// The promise is created here, once per request, so its identity is stable: a client component that
// waits on it gets the same promise on every render.
export const loadCardsView = (userId: string) => {
  const data = loadCardsPageData(userId);

  return {
    table: data.then(({ cards }) => ({ rows: toCardRows(cards) })),
  };
};
