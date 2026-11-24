"use client";

import { useEffect, useRef, useState } from "react";
import {
  PHONE_COUNTRIES,
  countryByCode,
  formatNational,
  nationalError,
  normalizeNational,
  parseStoredPhone,
  type PhoneCountry,
} from "@/lib/phone";

/**
 * Country code picker plus number. Only digits can be entered, the number is formatted as you type and
 * stops at the right length for the country, and a pasted "+1 (201) 555-0123" is understood. Reports one
 * combined string ("+1 2015550123"), or "" while empty, so the form payload and the server checks keep working.
 */
export default function PhoneField({
  onChange,
  required = false,
  inputClass,
  initialValue = "",
}: {
  onChange: (value: string) => void;
  required?: boolean;
  inputClass: string;
  /** A previously saved value to start from. */
  initialValue?: string;
}) {
  const [start] = useState(() => (initialValue ? parseStoredPhone(initialValue) : null));
  const [countryCode, setCountryCode] = useState(start?.country.code ?? "US");
  const [digits, setDigits] = useState(start?.digits ?? "");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const country = countryByCode(countryCode);
  const display = formatNational(country, digits);
  const problem = digits ? nationalError(country, digits) : null;

  // Native form validation then blocks submit with the same message.
  useEffect(() => {
    inputRef.current?.setCustomValidity(problem ?? "");
  }, [problem]);

  function emit(c: PhoneCountry, d: string) {
    onChange(d ? `${c.dial} ${d}` : "");
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <select
            aria-label="Country code"
            value={countryCode}
            onChange={(e) => {
              const next = countryByCode(e.target.value);
              const nextDigits = normalizeNational(next, digits);
              setCountryCode(next.code);
              setDigits(nextDigits);
              emit(next, nextDigits);
            }}
            className={`${inputClass} w-[5.5rem] appearance-none pr-6`}
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.dial}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40">▾</span>
        </div>
        <input
          ref={inputRef}
          required={required}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={country.example}
          aria-label={`Phone number (${country.dial})`}
          aria-invalid={touched && !!problem}
          maxLength={24}
          className={inputClass}
          value={display}
          onBlur={() => setTouched(true)}
          onChange={(e) => {
            const raw = e.target.value;
            let next = normalizeNational(country, raw);
            // Backspacing over a formatting character (")", "-", space) removes no digit; drop one so it never sticks.
            if (next === digits && raw.length < display.length) next = digits.slice(0, -1);
            setDigits(next);
            emit(country, next);
          }}
        />
      </div>
      {touched && problem && <p className="mt-1 text-xs text-error">{problem}</p>}
    </div>
  );
}
