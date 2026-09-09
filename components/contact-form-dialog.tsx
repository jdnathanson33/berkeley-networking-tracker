"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { PRIORITIES, type Contact, type Priority } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ContactDraft = {
  name: string;
  company: string;
  role: string;
  where_met: string;
  notes: string;
  priority: Priority;
};

const emptyDraft: ContactDraft = {
  name: "",
  company: "",
  role: "",
  where_met: "",
  notes: "",
  priority: "medium",
};

function toDraft(contact: Contact | null): ContactDraft {
  if (!contact) return emptyDraft;
  return {
    name: contact.name,
    company: contact.company ?? "",
    role: contact.role ?? "",
    where_met: contact.where_met ?? "",
    notes: contact.notes ?? "",
    priority: contact.priority,
  };
}

export function ContactFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Contact | null;
  onSubmit: (
    draft: ContactDraft,
  ) => Promise<{ ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> }>;
}) {
  const [draft, setDraft] = React.useState<ContactDraft>(emptyDraft);
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Reset the form whenever the dialog opens for a different contact.
  React.useEffect(() => {
    if (open) {
      setDraft(toDraft(editing));
      setFormError(null);
      setFieldErrors({});
    }
  }, [open, editing]);

  function set<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const result = await onSubmit(draft);
      if (result.ok) {
        onOpenChange(false);
      } else {
        setFormError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update what you know about this person."
              : "Someone you want to stay connected with at Berkeley."}
          </DialogDescription>
        </DialogHeader>

        {/* noValidate: we want OUR error messages, tested and consistent,
            rather than the browser's built-in validation bubbles. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="c-name">
              Name <span className="text-[var(--destructive)]">*</span>
            </Label>
            <Input
              id="c-name"
              value={draft.name}
              invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "c-name-error" : undefined}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Priya Raman"
            />
            {fieldErrors.name && (
              <p id="c-name-error" className="text-sm text-[var(--destructive)]">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-company">Company</Label>
              <Input
                id="c-company"
                value={draft.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Pixar"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-role">Role</Label>
              <Input
                id="c-role"
                value={draft.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder="Head of Production"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-where">Where you met</Label>
              <Input
                id="c-where"
                value={draft.where_met}
                onChange={(e) => set("where_met", e.target.value)}
                placeholder="Haas orientation"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-priority">Priority</Label>
              <Select
                value={draft.priority}
                onValueChange={(value) => set("priority", value as Priority)}
              >
                <SelectTrigger id="c-priority" aria-invalid={Boolean(fieldErrors.priority)}>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority} className="capitalize">
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.priority && (
                <p className="text-sm text-[var(--destructive)]">{fieldErrors.priority}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea
              id="c-notes"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Worked on Coco. Said to email in October about summer internships."
            />
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
            >
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
