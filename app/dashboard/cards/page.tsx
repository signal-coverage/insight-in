import { Cards } from "@/components/Cards";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadCardsView } from "./loadCardsView";

export default async function CardsPage() {
  const userId = await requireUserId();

  // Not awaited on purpose. The session check above is quick; the database work starts here and
  // streams in behind the page, so the page's structure is on screen at once and only the table
  // waits for its data.
  const view = loadCardsView(userId);

  return <Cards {...view} />;
}
