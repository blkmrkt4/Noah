"use client";

import { useState, type KeyboardEvent, type SyntheticEvent } from "react";

/**
 * Click-to-reveal for a question slug. Closed state is a tiny `</>` glyph
 * that is unobtrusive next to the prompt; open state shows the full slug
 * at readable size with an inline × to hide. Uses span + role="button"
 * (not a real button) because callers often nest this inside a clickable
 * row, and nested buttons are invalid HTML.
 */
export function SlugReveal({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(e: SyntheticEvent) {
    e.stopPropagation();
    setOpen((o) => !o);
  }

  function onKey(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(e);
    }
  }

  if (open) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={onKey}
        title="Hide slug"
        className={`inline-flex items-center gap-1.5 cursor-pointer select-text ${className ?? ""}`}
      >
        <code className="text-xs text-ey-yellow font-mono">{slug}</code>
        <span className="text-[10px] text-ey-sonic-silver" aria-hidden>
          ×
        </span>
      </span>
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={onKey}
      title="Show question slug"
      aria-label="Show question slug"
      className={`inline-flex items-center text-[10px] text-ey-yellow/60 hover:text-ey-yellow font-mono cursor-pointer select-none ${className ?? ""}`}
    >
      &lt;/&gt;
    </span>
  );
}
