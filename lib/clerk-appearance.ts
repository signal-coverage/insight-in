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
