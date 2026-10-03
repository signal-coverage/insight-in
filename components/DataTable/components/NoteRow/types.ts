import type { ReactNode } from "react";

export interface NoteRowProps {
  id: string;
  // How many columns the note spans.
  columnCount: number;
  children: ReactNode;
}
