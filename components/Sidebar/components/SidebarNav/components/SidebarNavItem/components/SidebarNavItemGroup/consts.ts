// Closing is delayed slightly so moving the pointer from the trigger to the popover
// content (which renders elsewhere in the DOM, not nested inside the trigger) doesn't
// flicker the flyout shut in the gap between the two.
export const HOVER_CLOSE_DELAY_MS = 150;
