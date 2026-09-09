"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import type { Contact, SortField } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  contacts: Contact[];
  sort: SortField;
  direction: "asc" | "desc";
  onSortChange: (field: SortField) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  busyId: number | null;
};

const COLUMNS: { field: SortField; label: string; className?: string }[] = [
  { field: "name", label: "Name" },
  { field: "company", label: "Company / Role" },
  { field: "priority", label: "Priority" },
  { field: "created_at", label: "Added" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContactList({
  contacts,
  sort,
  direction,
  onSortChange,
  onEdit,
  onDelete,
  busyId,
}: Props) {
  return (
    <>
      {/* ---------- Desktop: a real table ---------- */}
      <div className="hidden overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Your networking contacts</caption>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
              {COLUMNS.map((column) => {
                const active = sort === column.field;
                return (
                  <th key={column.field} scope="col" className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => onSortChange(column.field)}
                      aria-sort={
                        active
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded font-medium transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] outline-none",
                        active
                          ? "text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {column.label}
                      {!active && <ChevronsUpDown className="size-3.5 opacity-50" />}
                      {active &&
                        (direction === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        ))}
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className={cn(
                  "border-b border-[var(--border)] last:border-0 transition-opacity",
                  busyId === contact.id && "opacity-50",
                )}
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-medium">{contact.name}</div>
                  {contact.where_met && (
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      Met at {contact.where_met}
                    </div>
                  )}
                  {contact.notes && (
                    <p className="mt-1 max-w-md text-xs text-[var(--muted-foreground)] line-clamp-2">
                      {contact.notes}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <div>{contact.company || "—"}</div>
                  {contact.role && (
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {contact.role}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <PriorityBadge priority={contact.priority} />
                </td>
                <td className="px-4 py-3 align-top text-[var(--muted-foreground)]">
                  {formatDate(contact.created_at)}
                </td>
                <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(contact)}
                    disabled={busyId === contact.id}
                    aria-label={`Edit ${contact.name}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(contact)}
                    disabled={busyId === contact.id}
                    aria-label={`Delete ${contact.name}`}
                    className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Mobile: cards, because a 5-column table on a phone is unusable ---------- */}
      <ul className="flex flex-col gap-3 md:hidden">
        {contacts.map((contact) => (
          <li
            key={contact.id}
            className={cn(
              "rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-opacity",
              busyId === contact.id && "opacity-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-medium">{contact.name}</h3>
                {(contact.company || contact.role) && (
                  <p className="mt-0.5 truncate text-sm text-[var(--muted-foreground)]">
                    {[contact.role, contact.company].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <PriorityBadge priority={contact.priority} className="shrink-0" />
            </div>

            {contact.where_met && (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Met at {contact.where_met}
              </p>
            )}
            {contact.notes && (
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">{contact.notes}</p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
              <span className="text-xs text-[var(--muted-foreground)]">
                Added {formatDate(contact.created_at)}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(contact)}
                  disabled={busyId === contact.id}
                >
                  <Pencil /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(contact)}
                  disabled={busyId === contact.id}
                  className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
