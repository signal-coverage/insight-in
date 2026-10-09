import { LINE_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { CellLinesProps } from "./types";

// Several short values in one cell, one per line: the caps of a credit card, one per currency.
export function CellLines({ lines }: CellLinesProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      {lines.map(({ key, text }) => (
        <span key={key} className={LINE_CLASS_NAME}>
          {text}
        </span>
      ))}
    </div>
  );
}
