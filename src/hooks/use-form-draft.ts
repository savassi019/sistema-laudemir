"use client";

import { useEffect, useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

const TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function useFormDraft<T extends FieldValues>(
  key: string,
  form: UseFormReturn<T>,
) {
  const restoredRef = useRef(false);

  // Restore once on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(`draft:${key}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts: number; values: Partial<T> };
      if (Date.now() - parsed.ts > TTL_MS) {
        localStorage.removeItem(`draft:${key}`);
        return;
      }
      form.reset(parsed.values as T, { keepDefaultValues: false });
    } catch {
      // ignore corrupt data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Save on every change (debounced 800ms)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = form.watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(`draft:${key}`, JSON.stringify({ ts: Date.now(), values }));
        } catch {
          // ignore quota errors
        }
      }, 800);
    });
    return () => {
      sub.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function clearDraft() {
    try {
      localStorage.removeItem(`draft:${key}`);
    } catch {
      // ignore
    }
  }

  return { clearDraft };
}
