import { RdwError } from "./errors";

export type ErrorMessageKey = "error.rdw_unavailable" | "error.generic";

function isNetworkError(err: unknown): boolean {
  return err instanceof Error && typeof (err as NodeJS.ErrnoException).code === "string";
}

/** The locale key that explains a failed RDW lookup to the user. */
export function errorMessageKey(err: unknown): ErrorMessageKey {
  if (err instanceof RdwError || isNetworkError(err)) return "error.rdw_unavailable";
  return "error.generic";
}
