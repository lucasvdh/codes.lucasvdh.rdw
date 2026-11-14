const MAX_PLATE_LENGTH = 8;

/** Turns user input into the plate as the RDW stores it, or undefined when there is no usable plate. */
export function normalizeLicensePlate(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const plate = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return plate.length > 0 && plate.length <= MAX_PLATE_LENGTH ? plate : undefined;
}
