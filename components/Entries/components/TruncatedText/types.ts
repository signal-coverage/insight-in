export interface TruncatedTextProps {
  // The text, cut with an ellipsis when it does not fit, and shown whole in the tooltip.
  children: string;
  // How the text is laid out (it needs to be a block with a width limit to be cut).
  className?: string;
  // For tests that read the text back from a list.
  testId?: string;
}
