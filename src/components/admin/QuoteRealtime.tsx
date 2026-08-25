"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * The only realtime subscription in the product (spec §12.5): a live toast when
 * a quote request lands. The public site opens no socket at all.
 */
export function QuoteRealtime() {
  const router = useRouter();

  React.useEffect(() => {
    const sb = getBrowserClient();
    if (!sb) return;

    const channel = sb
      .channel("admin:quote_requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quote_requests" },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { reference?: string; company?: string; full_name?: string };
          toast.success(`New quote request ${row.reference ?? ""}`, {
            description: row.company || row.full_name || "View it in the pipeline",
            duration: 12000,
          });
          router.refresh();
        },
      )
      .subscribe();

    return () => { void sb.removeChannel(channel); };
  }, [router]);

  return null;
}
