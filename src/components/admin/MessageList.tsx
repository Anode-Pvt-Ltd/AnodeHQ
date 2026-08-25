"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import { setMessageStatus } from "@/lib/mutations/quotes";

interface Message {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string;
  createdAt: string;
}

const STATUSES = ["new", "replied", "archived", "spam"] as const;

const TONE: Record<string, "brand" | "success" | "neutral" | "outline"> = {
  new: "brand", replied: "success", archived: "neutral", spam: "outline",
};

export function MessageList({ messages }: { messages: Message[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<string>("new");
  const [pending, startTransition] = React.useTransition();

  const shown = filter === "all" ? messages : messages.filter((m) => m.status === filter);

  const update = (id: string, status: (typeof STATUSES)[number]) => {
    startTransition(async () => {
      const res = await setMessageStatus(id, status);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  if (!messages.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <h2 className="text-h3 mb-2 text-fg">No messages yet</h2>
        <p className="text-body-sm text-fg-muted">Submissions from /contact arrive here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
              filter === s
                ? "border-brand bg-brand text-on-brand"
                : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {s}
            <span className="ml-1.5 tabular opacity-70">
              {s === "all" ? messages.length : messages.filter((m) => m.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-body-sm text-fg-subtle">
          Nothing with that status.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((m) => (
            <li key={m.id}>
              <article className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-h4 text-fg">{m.subject || `Message from ${m.name}`}</p>
                    <p className="text-body-sm text-fg-muted">
                      {m.name} ·{" "}
                      <a href={`mailto:${m.email}`} className="text-accent hover:underline">{m.email}</a>
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[m.status] ?? "neutral"}>{m.status}</Badge>
                    <span className="tabular text-[0.75rem] text-fg-subtle">{m.createdAt}</span>
                  </div>
                </div>

                <p className="mb-4 whitespace-pre-wrap text-body-sm leading-relaxed text-fg-muted">
                  {m.message}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "your message"}`)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[0.8125rem] font-semibold text-on-brand hover:bg-brand-hover"
                  >
                    <Mail className="size-3.5" aria-hidden /> Reply
                  </a>
                  {STATUSES.filter((s) => s !== m.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update(m.id, s)}
                      disabled={pending}
                      className="h-9 rounded-full border border-border px-3.5 text-[0.8125rem] font-medium text-fg-muted hover:border-brand hover:text-brand disabled:opacity-50"
                    >
                      Mark {s}
                    </button>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
