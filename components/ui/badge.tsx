import * as React from "react";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/validation";

const priorityStyles: Record<Priority, string> = {
  high: "bg-[var(--priority-high-bg)] text-[var(--priority-high)]",
  medium: "bg-[var(--priority-medium-bg)] text-[var(--priority-medium)]",
  low: "bg-[var(--priority-low-bg)] text-[var(--priority-low)]",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        priorityStyles[priority],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {priority}
    </span>
  );
}
