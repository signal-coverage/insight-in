import type { ComponentType, SVGProps } from "react";

// What a block is about: money coming in, money going out, or what is left over time.
export type HeadingTone = "income" | "expense" | "balance";

export interface BlockHeadingProps {
  title: string;
  // A line under the title that says what the block holds.
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: HeadingTone;
}
