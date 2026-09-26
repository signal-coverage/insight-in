export interface Crumb {
  label: string;
  /** Omitted for the current page, which is rendered as plain text. */
  href?: string;
}
