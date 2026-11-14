const MAX_PLATE_LENGTH = 8;

/** Turns user input into the plate as the RDW stores it, or undefined when there is no usable plate. */
export function normalizeLicensePlate(input: unknown): string | undefined {
  const check = checkLicensePlate(input);
  return "plate" in check ? check.plate : undefined;
}

export type PlateCheck =
  | { plate: string }
  | { error: "error.license_plate_missing" | "error.license_plate_invalid" };

/** Like normalizeLicensePlate, with the reason a plate can't be used. */
export function checkLicensePlate(input: unknown): PlateCheck {
  const plate = typeof input === "string" ? input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : "";
  if (plate.length === 0) return { error: "error.license_plate_missing" };
  if (plate.length > MAX_PLATE_LENGTH) return { error: "error.license_plate_invalid" };
  return { plate };
}
