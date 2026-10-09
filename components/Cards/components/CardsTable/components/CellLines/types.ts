export interface CellLine {
  key: string;
  text: string;
}

export interface CellLinesProps {
  lines: readonly CellLine[];
}
