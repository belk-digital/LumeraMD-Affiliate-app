"use client";

import { useEffect, useRef, useState } from "react";
import { formatValue, type ValueFormat } from "@/lib/format";
import { useReducedMotion } from "@/lib/useReducedMotion";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Renders the final value on the server (so it's correct without JS), then on the client
 * counts up to it. When the value changes later, it animates from what's on screen.
 */
export default function CountUp({
  value,
  format = "int",
  duration = 900,
}: {
  value: number;
  format?: ValueFormat;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    if (reduced) {
      current.current = value;
      setDisplay(value);
      return;
    }

    // First mount counts up from zero; later changes animate from the visible number.
    const from = first.current ? 0 : current.current;
    first.current = false;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const next = from + (value - from) * easeOutCubic(t);
      current.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return <>{formatValue(display, format)}</>;
}
