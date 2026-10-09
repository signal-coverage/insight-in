import { loadBanksBoard } from "@/core/banks/pageData";

// Starts loading everything the page needs and returns immediately, without awaiting it. The page
// hands the promise straight to the client component, so the header and the toolbar render at once
// and only the board waits for its data.
//
// The promise is created here, once per request, so its identity is stable: a client component that
// waits on it gets the same promise on every render.
export const loadBanksView = (userId: string) => ({
  board: loadBanksBoard(userId),
});
