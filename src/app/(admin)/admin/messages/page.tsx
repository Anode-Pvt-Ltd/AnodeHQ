import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { MessageList } from "@/components/admin/MessageList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireRole("sales");
  const service = createServiceClient();

  let rows: Record<string, unknown>[] = [];
  if (service) {
    const { data } = await service
      .from("contact_messages")
      .select("id, name, email, phone, subject, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    rows = (data ?? []) as Record<string, unknown>[];
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">Messages</h1>
        <p className="mt-1.5 text-body-sm text-fg-muted">
          Everything from the contact form. Anything with a defined scope arrives in Quotes instead.
        </p>
      </header>

      <MessageList
        messages={rows.map((r) => ({
          id: String(r.id),
          name: String(r.name ?? ""),
          email: String(r.email ?? ""),
          phone: r.phone ? String(r.phone) : null,
          subject: r.subject ? String(r.subject) : null,
          message: String(r.message ?? ""),
          status: String(r.status ?? "new"),
          createdAt: formatDate(String(r.created_at)),
        }))}
      />
    </div>
  );
}
