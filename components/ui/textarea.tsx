"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "flex min-h-[88px] w-full rounded-md border bg-[var(--card)] px-3 py-2 text-base md:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-colors",
      "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--ring)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      invalid
        ? "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]"
        : "border-[var(--input)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
