// Clerk's own UI (sign-in form, account menu, user button) reads these variables. They point
// at the app's theme tokens (see app/globals.css), so Clerk follows the palette and switches
// with the light/dark class instead of carrying a second, hard-coded set of colours.
export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "var(--accent)",
    colorPrimaryForeground: "var(--accent-foreground)",
    colorBackground: "var(--overlay)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted)",
    colorMuted: "var(--default)",
    colorInput: "var(--field-background)",
    colorInputForeground: "var(--field-foreground)",
    colorBorder: "var(--border)",
    colorNeutral: "var(--foreground)",
    colorRing: "var(--focus)",
    colorShadow: "transparent",
    colorDanger: "var(--foreground)",
    colorSuccess: "var(--foreground)",
    colorWarning: "var(--foreground)",
    colorModalBackdrop: "var(--backdrop)",
  },
};

// What the account page adds for <UserProfile />. The profile always draws itself as a raised card
// (a fixed width, a shadow and a border of its own), which the `elevation` option does not turn
// off, so it is the element styles that make it a plain block of the page: as wide as the page
// area, with the app's own border and no shadow. The colours already come from CLERK_APPEARANCE.
export const USER_PROFILE_APPEARANCE = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: {
      width: "100%",
      maxWidth: "100%",
      boxShadow: "none",
      border: "1px solid var(--border)",
    },
  },
};
