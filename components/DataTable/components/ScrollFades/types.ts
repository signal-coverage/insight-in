export interface ScrollFadesProps {
  showLeft: boolean;
  showRight: boolean;
  // Room taken by the scroll area's own scrollbars, which the fades must not cover.
  gutter: { right: number; bottom: number };
}
