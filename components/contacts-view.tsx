"use client";

import * as React from "react";
import { AlertCircle, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  PRIORITIES,
  type Contact,
  type Priority,
  type SortField,
} from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContactList } from "@/components/contact-list";
import { ContactFormDialog, type ContactDraft } from "@/components/contact-form-dialog";

type Status = "loading" | "ready" | "error";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "priority:asc", label: "Priority (high first)" },
  { value: "company:asc", label: "Company A–Z" },
  { value: "updated_at:desc", label: "Recently updated" },
];

export function ContactsView() {
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [status, setStatus] = React.useState<Status>("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [priorityFilter, setPriorityFilter] = React.useState<Priority | "all">("all");
  const [sort, setSort] = React.useState<SortField>("created_at");
  const [direction, setDirection] = React.useState<"asc" | "desc">("desc");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contact | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Contact | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  // Debounce the search box so we aren't firing a request per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = React.useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams({ sort, dir: direction });
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (debouncedSearch) params.set("q", debouncedSearch);

    try {
      const response = await fetch(`/api/contacts?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus("error");
        setLoadError(payload?.error ?? "Couldn't load your contacts.");
        return;
      }
      setContacts(payload.contacts ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
      setLoadError("Couldn't reach the server. Check your connection and try again.");
    }
  }, [sort, direction, priorityFilter, debouncedSearch]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(draft: ContactDraft) {
    const isEdit = Boolean(editing);
    const url = isEdit ? `/api/contacts/${editing!.id}` : "/api/contacts";

    try {
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          ok: false as const,
          message: payload?.error ?? "Something went wrong. Please try again.",
          fieldErrors: payload?.fieldErrors,
        };
      }

      toast.success(isEdit ? "Contact updated" : `${draft.name} added`);
      await load();
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        message: "Couldn't reach the server. Check your connection and try again.",
      };
    }
  }

  async function handleDelete(contact: Contact) {
    setPendingDelete(null);
    setBusyId(contact.id);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        toast.error(payload?.error ?? "Couldn't delete that contact.");
        return;
      }
      toast.success(`${contact.name} deleted`);
      await load();
    } catch {
      toast.error("Couldn't reach the server. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function handleSortColumn(field: SortField) {
    if (field === sort) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setDirection(field === "created_at" || field === "updated_at" ? "desc" : "asc");
    }
  }

  const isFiltered = priorityFilter !== "all" || debouncedSearch.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="search" className="text-xs text-[var(--muted-foreground)]">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, company, role…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5 sm:w-36">
              <Label htmlFor="priority-filter" className="text-xs text-[var(--muted-foreground)]">
                Priority
              </Label>
              <Select
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as Priority | "all")}
              >
                <SelectTrigger id="priority-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority} className="capitalize">
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-1 flex-col gap-1.5 sm:w-48">
              <Label htmlFor="sort" className="text-xs text-[var(--muted-foreground)]">
                Sort
              </Label>
              <Select
                value={`${sort}:${direction}`}
                onValueChange={(value) => {
                  const [field, dir] = value.split(":");
                  setSort(field as SortField);
                  setDirection(dir as "asc" | "desc");
                }}
              >
                <SelectTrigger id="sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="sm:w-auto"
        >
          <Plus /> Add contact
        </Button>
      </div>

      {/* ---------- Loading ---------- */}
      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading your contacts</span>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/50"
            />
          ))}
        </div>
      )}

      {/* ---------- Error ---------- */}
      {status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-6"
        >
          <div className="flex items-center gap-2 font-medium text-[var(--destructive)]">
            <AlertCircle className="size-5" />
            Couldn&apos;t load your contacts
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus("loading");
              void load();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {/* ---------- Empty ---------- */}
      {status === "ready" && contacts.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--border)] px-6 py-16 text-center">
          <div className="rounded-full bg-[var(--muted)] p-3">
            <UserPlus className="size-6 text-[var(--muted-foreground)]" />
          </div>
          {isFiltered ? (
            <>
              <h2 className="font-medium">No contacts match those filters</h2>
              <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
                Try a different search term, or set the priority filter back to All.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setPriorityFilter("all");
                }}
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <h2 className="font-medium">No contacts yet</h2>
              <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
                Add the first person you want to stay connected with at Berkeley. Notes
                about where you met are the ones you&apos;ll thank yourself for later.
              </p>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus /> Add your first contact
              </Button>
            </>
          )}
        </div>
      )}

      {/* ---------- The list ---------- */}
      {status === "ready" && contacts.length > 0 && (
        <>
          <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
            {isFiltered && " matching your filters"}
          </p>
          <ContactList
            contacts={contacts}
            sort={sort}
            direction={direction}
            onSortChange={handleSortColumn}
            onEdit={(contact) => {
              setEditing(contact);
              setFormOpen(true);
            }}
            onDelete={setPendingDelete}
            busyId={busyId}
          />
        </>
      )}

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the contact and its notes permanently. This can&apos;t be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => pendingDelete && handleDelete(pendingDelete)}
              >
                {busyId !== null && <Loader2 className="animate-spin" />}
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
