
export type Paise = number;

// -0 and 0 behave the same in maths but not in some comparisons; keep it simple.
function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Convert a rupee amount (such as a 2-decimal mock price) to whole paise. */
export function rupeesToPaise(rupees: number): Paise {
  if (typeof rupees !== "number" || !Number.isFinite(rupees)) {
    throw new RangeError("Amount must be a finite number.");
  }
  return normalizeZero(Math.round(rupees * 100));
}

/** Convert whole paise back to rupees for display / API responses. */
export function paiseToRupees(paise: Paise): number {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Paise must be a whole number.");
  }
  return normalizeZero(paise / 100);
}

/** price (paise) x quantity (shares), checked so the result is still exact. */
export function mulPaise(pricePaise: Paise, quantity: number): Paise {
  const result = pricePaise * quantity;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Order value is too large to calculate exactly.");
  }
  return result;
}

/** round(total x part / whole), used to release part of a position's cost. */
export function proportionalShare(total: Paise, part: number, whole: number): Paise {
  const product = total * part;
  if (!Number.isSafeInteger(product) || whole <= 0) {
    throw new RangeError("Cannot calculate an exact share of this amount.");
  }
  return normalizeZero(Math.round(product / whole));
}

/** numerator / denominator as a percentage with 2 decimals (both in paise). */
export function percentOf(numerator: Paise, denominator: Paise): number {
  if (denominator <= 0) return 0;
  return normalizeZero(Math.round((numerator * 10000) / denominator) / 100);
}

/** Format paise as an Indian-rupee string for error messages. */
export function formatPaiseINR(paise: Paise): string {
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}