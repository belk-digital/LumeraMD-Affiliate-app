"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "US", dial: "+1" },
  { code: "CA", dial: "+1" },
  { code: "GB", dial: "+44" },
  { code: "AU", dial: "+61" },
  { code: "MX", dial: "+52" },
  { code: "IN", dial: "+91" },
  { code: "PK", dial: "+92" },
];

/**
 * Country code picker plus number. Reports one combined string ("+1 2015550123"), or "" while the
 * number is empty, so the existing phone fields and validation on the server keep working.
 */
export default function PhoneField({
  onChange,
  required = false,
  inputClass,
}: {
  onChange: (value: string) => void;
  required?: boolean;
  inputClass: string;
}) {
  const [country, setCountry] = useState("US");
  const [number, setNumber] = useState("");
  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+1";

  function emit(nextCountry: string, nextNumber: string) {
    const d = COUNTRIES.find((c) => c.code === nextCountry)?.dial ?? "+1";
    onChange(nextNumber.trim() ? `${d} ${nextNumber.trim()}` : "");
  }

  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        <select
          aria-label="Country code"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            emit(e.target.value, number);
          }}
          className={`${inputClass} w-[5.5rem] appearance-none pr-6`}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} {c.dial}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40">▾</span>
      </div>
      <input
        required={required}
        type="tel"
        autoComplete="tel-national"
        placeholder="(201) 555-0123"
        aria-label={`Phone number (${dial})`}
        className={inputClass}
        value={number}
        onChange={(e) => {
          setNumber(e.target.value);
          emit(country, e.target.value);
        }}
      />
    </div>
  );
}
