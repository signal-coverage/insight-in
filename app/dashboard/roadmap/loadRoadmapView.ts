import { listBoard } from "@/core/roadmap/service";

// Starts loading everything the page needs and returns immediately, without awaiting it. The page
// hands the promise straight to the client component, so the header renders at once and only the
// board waits for its data.
//
// The promise is created here, once per request, so its identity is stable: a client component that
// waits on it gets the same promise on every render.
export const loadRoadmapView = (userId: string) => ({
  board: listBoard(userId),
});
