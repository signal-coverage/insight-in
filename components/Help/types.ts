import type { ComponentType, SVGProps } from "react";

export type LegendIcon = ComponentType<SVGProps<SVGSVGElement>>;

// The colour an entry is drawn in: the app's own tokens, so every theme has them.
export type LegendTone = "neutral" | "positive" | "warning" | "danger";

// How to recognise, in a table, the marker an entry explains: by the words it says, or by how they
// begin when the rest changes with the row ("Se cotizó en 20 USD").
export type LegendMarker = { label: string } | { labelPrefix: string };

export interface LegendEntry {
  id: string;
  // What the thing is called. For a marker, exactly the words the app shows for it.
  name: string;
  // One simple sentence about what it means.
  description: string;
  // The pages it shows up in, named as their titles.
  appearsIn: readonly string[];
  tone: LegendTone;
  // The very icon the app draws. An entry without one is a colour, and shows a swatch of it.
  icon?: LegendIcon;
  // Set when the entry explains a marker the tables draw, so a guard can hold the two together.
  marker?: LegendMarker;
}

export interface LegendGroup {
  id: string;
  title: string;
  entries: readonly LegendEntry[];
}
