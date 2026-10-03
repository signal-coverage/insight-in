export interface InstallmentPreviewProps {
  // The live line ("12 cuotas de ... · total ..."), or null while the data is not enough to work it
  // out.
  text: string | null;
}
