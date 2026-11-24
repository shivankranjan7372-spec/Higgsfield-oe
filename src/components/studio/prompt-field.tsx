"use client";

import { useLayoutEffect, useRef } from "react";

/** The box never grows past this; after that it scrolls. */
const TALLEST = 200;

/**
 * The prompt box: two lines tall when empty, growing with the text. Enter sends, Shift+Enter
 * starts a new line. Files pasted into it are handed to `onFiles` instead of becoming text.
 */
export function PromptField({
  value,
  onChange,
  onSubmit,
  onFiles,
  placeholder,
  maxLength,
  label = "Prompt",
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onFiles?: (files: File[]) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TALLEST)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      // A little past the limit still fits, so the person sees the "too long" message instead of silent cut-off.
      maxLength={maxLength ? maxLength + 500 : undefined}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        onSubmit();
      }}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files);
        if (!files.length || !onFiles) return;
        e.preventDefault();
        onFiles(files);
      }}
      className="scroll-quiet block min-h-12 w-full resize-none bg-transparent p-1 text-sm leading-5 text-text-primary outline-none"
    />
  );
}
