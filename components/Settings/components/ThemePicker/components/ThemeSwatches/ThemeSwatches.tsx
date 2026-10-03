import { ROOT_CLASS_NAME, SWATCH_CLASS_NAME } from "./styles";
import type { ThemeSwatchesProps } from "./types";

// A theme's palette as a strip of dots. Decoration only: the theme's name says what it is.
export function ThemeSwatches({ colors }: ThemeSwatchesProps) {
  return (
    <span className={ROOT_CLASS_NAME} aria-hidden="true">
      {colors.map((color) => (
        <span
          key={color}
          className={SWATCH_CLASS_NAME}
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}
