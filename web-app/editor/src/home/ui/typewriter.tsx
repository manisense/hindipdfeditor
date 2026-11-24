import { useEffect, useState } from "react";

/** Splits text into grapheme clusters so a Devanagari conjunct or matra is never shown half-typed. */
function clusters(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("hi", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Types each phrase, holds it, deletes it, then moves on.
 * Starts fully typed so the prerendered HTML carries real text, and stays still
 * under `prefers-reduced-motion`. `onPhrase` fires when a phrase is complete.
 *
 * @param typeMs   delay per typed grapheme, in milliseconds
 * @param deleteMs delay per deleted grapheme, in milliseconds
 * @param holdMs   how long a finished phrase stays, in milliseconds
 */
export function Typewriter({
  phrases,
  typeMs = 65,
  deleteMs = 30,
  holdMs = 1800,
  onPhrase,
  caretClassName = "bg-brand",
}: {
  phrases: string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  onPhrase?: (index: number, complete: boolean) => void;
  caretClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(() => clusters(phrases[0] ?? "").length);
  const [deleting, setDeleting] = useState(false);
  const parts = clusters(phrases[index] ?? "");

  useEffect(() => {
    if (prefersReducedMotion() || phrases.length < 2) return;
    let delay = deleting ? deleteMs : typeMs;
    let next: () => void;
    if (!deleting && shown === parts.length) {
      delay = holdMs;
      next = () => setDeleting(true);
    } else if (deleting && shown === 0) {
      delay = 250;
      next = () => {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      };
    } else {
      next = () => setShown((n) => n + (deleting ? -1 : 1));
    }
    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
  }, [shown, deleting, parts.length, phrases.length, typeMs, deleteMs, holdMs]);

  const complete = !deleting && shown === parts.length;
  useEffect(() => {
    onPhrase?.(index, complete);
  }, [index, complete, onPhrase]);

  return (
    <>
      {parts.slice(0, shown).join("")}
      <span
        aria-hidden="true"
        className={`caret h-[0.9em] translate-y-[0.08em] rounded-sm ${caretClassName}`}
      />
    </>
  );
}
