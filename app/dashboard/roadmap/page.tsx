import { Roadmap } from "@/components/Roadmap";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadRoadmapView } from "./loadRoadmapView";

export default async function RoadmapPage() {
  const userId = await requireUserId();

  // Not awaited on purpose. The session check above is quick; the database work starts here and
  // streams in behind the page, so the header is on screen at once and only the board waits for its
  // data.
  const view = loadRoadmapView(userId);

  return <Roadmap {...view} />;
}
