"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Paperclip, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/primitives/Button";
import { Select, Textarea } from "@/components/primitives/Field";
import { assignQuote, getAttachmentUrl, moveQuoteStatus, saveInternalNotes } from "@/lib/mutations/quotes";
import type { QuoteStatus } from "@/types/app";

const PIPELINE: QuoteStatus[] = ["new", "reviewing", "quoted", "won", "lost", "archived"];

export function QuoteControls({
  quoteId, status, assignedTo, internalNotes, staff, attachments,
}: {
  quoteId: string;
  status: string;
  assignedTo: string | null;
  internalNotes: string;
  staff: { id: string; name: string }[];
  attachments: { id: string; filename: string; sizeBytes: number }[];
}) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(internalNotes);
  const [pending, startTransition] = React.useTransition();

  const move = (next: QuoteStatus) => {
    startTransition(async () => {
      const res = await moveQuoteStatus(quoteId, next);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  const assign = (userId: string) => {
    startTransition(async () => {
      const res = await assignQuote(quoteId, userId || null);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  const saveNotes = () => {
    startTransition(async () => {
      const res = await saveInternalNotes(quoteId, notes);
      toast[res.ok ? "success" : "error"](res.message ?? "");
    });
  };

  const download = (attachmentId: string, filename: string) => {
    startTransition(async () => {
      const res = await getAttachmentUrl(attachmentId);
      if (!res.ok || !res.url) {
        toast.error(res.message ?? "Could not prepare that download.");
        return;
      }
      // 60-second signed URL, minted server-side and logged.
      window.open(res.url, "_blank", "noopener");
      toast.success(`Opening ${filename}`);
    });
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-h4 mb-5 text-fg">Triage</h2>

      <div className="mb-6">
        <p className="text-label mb-2.5 text-fg-subtle">Pipeline</p>
        <ol className="flex flex-wrap gap-1.5">
          {PIPELINE.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => move(s)}
                disabled={pending || s === status}
                aria-current={s === status ? "step" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:cursor-default",
                  s === status
                    ? "border-brand bg-brand text-on-brand"
                    : "border-border text-fg-muted hover:border-brand hover:text-brand disabled:opacity-50",
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-6 max-w-sm">
        <label htmlFor="assignee" className="text-label mb-2 block text-fg-subtle">Assigned to</label>
        <Select
          id="assignee"
          defaultValue={assignedTo ?? ""}
          disabled={pending}
          onChange={(e) => assign(e.currentTarget.value)}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </div>

      {attachments.length > 0 && (
        <div className="mb-6">
          <p className="text-label mb-2.5 text-fg-subtle">
            Attachments — private bucket, 60-second signed links, every open logged
          </p>
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3.5 py-2.5"
              >
                <Paperclip className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-body-sm text-fg">{a.filename}</span>
                <span className="tabular shrink-0 text-[0.75rem] text-fg-subtle">
                  {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => download(a.id, a.filename)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8125rem] font-medium text-accent hover:bg-surface disabled:opacity-50"
                >
                  <Download className="size-3.5" aria-hidden /> Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="notes" className="text-label mb-2 block text-fg-subtle">
          Internal notes — never shown to the client
        </label>
        <Textarea id="notes" rows={5} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={Save}
          iconPosition="start"
          className="mt-3"
          loading={pending}
          onClick={saveNotes}
        >
          Save notes
        </Button>
      </div>
    </section>
  );
}
