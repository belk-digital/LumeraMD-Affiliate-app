// Phone number rules shared by the forms (so people can't type junk) and the API routes (so a
// hand-built request can't either). Numbers are kept as "+<dial> <national digits>", e.g. "+1 2015550123".

export interface PhoneCountry {
  code: string;
  dial: string;
  /** Allowed length of the national number (without country code or a leading trunk 0). */
  min: number;
  max: number;
  /** Placeholder shown in the empty field. */
  example: string;
  /** Numbers here start with a trunk "0" when dialled locally; we drop it. */
  trunkZero: boolean;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "US", dial: "+1", min: 10, max: 10, example: "(201) 555-0123", trunkZero: false },
  { code: "CA", dial: "+1", min: 10, max: 10, example: "(416) 555-0123", trunkZero: false },
  { code: "GB", dial: "+44", min: 9, max: 10, example: "7400 123456", trunkZero: true },
  { code: "AU", dial: "+61", min: 9, max: 9, example: "412 345 678", trunkZero: true },
  { code: "MX", dial: "+52", min: 10, max: 10, example: "55 1234 5678", trunkZero: false },
  { code: "IN", dial: "+91", min: 10, max: 10, example: "98765 43210", trunkZero: true },
  { code: "PK", dial: "+92", min: 10, max: 10, example: "300 1234567", trunkZero: true },
];

export function countryByCode(code: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

/**
 * Turns whatever was typed or pasted into the national digits for a country: letters and symbols are
 * dropped, a pasted "+1 ..." / "0044 ..." country code is removed, a leading trunk 0 is removed, and the
 * result is cut to the longest valid length.
 */
export function normalizeNational(country: PhoneCountry, raw: string): string {
  let d = digitsOnly(raw);
  const dialDigits = digitsOnly(country.dial);
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith(dialDigits)) d = d.slice(dialDigits.length);
  } else if (d.length > country.max && d.startsWith(dialDigits)) {
    d = d.slice(dialDigits.length);
  }
  if (country.trunkZero && d.startsWith("0")) d = d.replace(/^0+/, "");
  return d.slice(0, country.max);
}

/** Display form while typing: "(201) 555-0123" for +1, simple groups elsewhere. */
export function formatNational(country: PhoneCountry, d: string): string {
  if (country.dial === "+1") {
    if (d.length <= 3) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return d.replace(/(\d{3,4})(?=\d)/g, "$1 ").trim();
}

/** Null when the national digits are acceptable, otherwise a short message. Empty is not checked here. */
export function nationalError(country: PhoneCountry, d: string): string | null {
  if (d.length < country.min) {
    const need = country.min === country.max ? `${country.min}` : `${country.min}-${country.max}`;
    return `Enter a ${need}-digit phone number.`;
  }
  if (d.length > country.max) return "Phone number is too long.";
  if (country.dial === "+1" && !/^[2-9]\d\d[2-9]/.test(d)) {
    return "Enter a valid US/Canada phone number.";
  }
  return null;
}

/** Reads a stored value back into country + digits. Free text from before these rules gets a best effort. */
export function parseStoredPhone(value: string): { country: PhoneCountry; digits: string } {
  const m = value.trim().match(/^(\+\d{1,3})[\s-]*(.*)$/);
  if (m) {
    const matches = PHONE_COUNTRIES.filter((c) => c.dial === m[1]);
    if (matches.length) return { country: matches[0], digits: normalizeNational(matches[0], m[2]) };
  }
  const us = PHONE_COUNTRIES[0];
  return { country: us, digits: normalizeNational(us, value) };
}

/** Server-side check of the combined string. Returns an error message or null. */
export function validatePhoneString(value: string, opts: { required: boolean }): string | null {
  const v = value.trim();
  if (!v) return opts.required ? "Please enter a phone number." : null;
  if (!/^[0-9+()\-.\s]{7,40}$/.test(v)) return "Please enter a valid phone number.";
  const m = v.match(/^(\+\d{1,3})\s(\d+)$/);
  if (m) {
    const candidates = PHONE_COUNTRIES.filter((c) => c.dial === m[1]);
    if (candidates.length) {
      // Valid if any country sharing this dial code accepts it (+1 is both US and Canada).
      return candidates.some((c) => nationalError(c, m[2]) === null) ? null : "Please enter a valid phone number.";
    }
  }
  // Older or unlisted format: fall back to the international length limits.
  const n = digitsOnly(v).length;
  return n >= 7 && n <= 15 ? null : "Please enter a valid phone number.";
}
