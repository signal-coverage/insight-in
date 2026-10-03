// The digits of what was typed or pasted, no more than `maxLength` of them. Only the digits of the
// Latin alphabet count, which is what the server accepts.
export const digitsOnly = (value: string, maxLength: number): string =>
  value.replace(/[^0-9]/g, "").slice(0, maxLength);
