export const isPromise = <T>(value: T | Promise<T>): value is Promise<T> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { then?: unknown }).then === "function";
