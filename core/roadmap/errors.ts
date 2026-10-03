// Kept apart from the service so actions can branch on it (and tests can mock the service) without
// the class disappearing with it.

// The card does not exist or is not the user's.
export class BoardItemNotFoundError extends Error {
  constructor() {
    super("Board item not found");
    this.name = "BoardItemNotFoundError";
  }
}
