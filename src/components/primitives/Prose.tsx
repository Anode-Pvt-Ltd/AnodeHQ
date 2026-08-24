import { cn } from "@/lib/utils";

/**
 * Server-rendered rich text. Content comes from our own trusted content layer
 * or from Tiptap JSON converted server-side — never from unsanitised user input.
 */
export function Prose({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "measure text-body-lg text-fg-muted",
        "[&>h3]:text-h3 [&>h3]:mt-10 [&>h3]:mb-3 [&>h3]:text-fg",
        "[&>h4]:text-h4 [&>h4]:mt-7 [&>h4]:mb-2 [&>h4]:text-fg",
        "[&>p]:mb-5",
        "[&>ul]:mb-5 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mb-2 [&>ul>li]:marker:text-brand",
        "[&>ol]:mb-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol>li]:mb-2 [&>ol>li]:marker:text-brand",
        "[&_strong]:font-semibold [&_strong]:text-fg",
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4",
        "[&>blockquote]:border-l-2 [&>blockquote]:border-brand [&>blockquote]:pl-5 [&>blockquote]:italic",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
