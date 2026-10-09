import { Banks } from "@/components/Banks";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadBanksView } from "./loadBanksView";

export default async function BanksPage() {
  const userId = await requireUserId();

  // Not awaited on purpose. The session check above is quick; the database work starts here and
  // streams in behind the page, so the header is on screen at once and only the board waits for its
  // data.
  const view = loadBanksView(userId);

  return <Banks {...view} />;
}
