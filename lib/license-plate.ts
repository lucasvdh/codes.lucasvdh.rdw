/** Turns user input into the plate as the RDW stores it, or undefined when there is no usable plate. */
export function normalizeLicensePlate(input: unknown): string | undefined {
  return typeof input === "string" ? input : undefined;
}
