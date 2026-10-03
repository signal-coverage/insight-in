import { EDGE_FADE_WIDTH_PX } from "./consts";
import { LEFT_FADE_CLASSNAME, RIGHT_FADE_CLASSNAME } from "./styles";
import type { ScrollFadesProps } from "./types";

// Soft edges that hint there is more table to scroll to; each one only shows on its own side.
export function ScrollFades({ showLeft, showRight, gutter }: ScrollFadesProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={LEFT_FADE_CLASSNAME}
        style={{
          width: EDGE_FADE_WIDTH_PX,
          bottom: gutter.bottom,
          opacity: showLeft ? 1 : 0,
        }}
      />
      <div
        aria-hidden="true"
        className={RIGHT_FADE_CLASSNAME}
        style={{
          width: EDGE_FADE_WIDTH_PX,
          right: gutter.right,
          bottom: gutter.bottom,
          opacity: showRight ? 1 : 0,
        }}
      />
    </>
  );
}
