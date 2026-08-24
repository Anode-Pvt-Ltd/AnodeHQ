import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { cn, formatDateShort } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { Img } from "@/components/media/Img";
import { Badge } from "@/components/primitives/Badge";
import type { IndustrySummary, PostSummary, ProjectCardData, ServiceSummary, TeamMember } from "@/types/app";

/* ---------------------------------------------------------- service */

export function ServiceCard({
  service, className, compact,
}: { service: ServiceSummary; className?: string; compact?: boolean }) {
  const Icon = getIcon(service.icon);
  return (
    <Link
      href={`/services/${service.slug}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-surface p-6 transition-all duration-[var(--dur-base)] ease-[var(--ease-standard)]",
        "hover:-translate-y-1 hover:border-brand/40 hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
        className,
      )}
    >
      <span className="mb-5 inline-flex size-11 items-center justify-center rounded-lg bg-teal-50 text-brand transition-colors group-hover:bg-brand group-hover:text-on-brand dark:bg-teal-900/50">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-h4 mb-2 text-fg">{service.title}</h3>
      <p className={cn("text-body-sm text-fg-muted", compact && "line-clamp-3")}>{service.summary}</p>
      <span className="mt-auto pt-6 text-brand" aria-hidden>
        <ArrowRight className="size-4 transition-transform duration-[var(--dur-base)] group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------- project */

export function ProjectCard({
  project, size = "md", priority,
}: { project: ProjectCardData; size?: "sm" | "md" | "lg"; priority?: boolean }) {
  const sizes =
    size === "sm"
      ? "(max-width: 640px) 80vw, 340px"
      : size === "lg"
        ? "(max-width: 768px) 100vw, 60vw"
        : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

  return (
    <Link
      href={`/projects/${project.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all duration-[var(--dur-base)] ease-[var(--ease-standard)]",
        "hover:-translate-y-1 hover:border-brand/40 hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
      )}
    >
      <Img
        media={project.cover}
        sizes={sizes}
        aspect="4/3"
        priority={priority}
        className="transition-transform duration-[var(--dur-slow)] ease-[var(--ease-standard)] group-hover:scale-[1.03]"
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-[0.75rem] text-fg-subtle">
          <span className="tabular">{project.year}</span>
          {project.industry && (
            <>
              <span aria-hidden>·</span>
              <span>{project.industry.name}</span>
            </>
          )}
          {project.isConfidential && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" aria-hidden /> Confidential
              </span>
            </>
          )}
        </div>
        <h3 className="text-h4 mb-1.5 text-fg transition-colors group-hover:text-brand">{project.title}</h3>
        <p className="mb-4 line-clamp-2 text-body-sm text-fg-muted">{project.summary}</p>
        <p className="mt-auto font-mono text-[0.6875rem] uppercase tracking-wide text-fg-subtle">
          {project.services.map((s) => s.title.split(" ")[0]).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

/* --------------------------------------------------------- industry */

export function IndustryCard({
  industry, wide,
}: { industry: IndustrySummary; wide?: boolean }) {
  const Icon = getIcon(industry.icon);
  return (
    <Link
      href={`/industries/${industry.slug}`}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-6 transition-all duration-[var(--dur-base)]",
        "hover:-translate-y-1 hover:border-brand/40 hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
        wide && "sm:col-span-2",
      )}
    >
      <div>
        <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
          <Icon className="size-[1.15rem]" aria-hidden />
        </span>
        <h3 className="text-h4 mb-1.5 text-fg transition-colors group-hover:text-brand">{industry.name}</h3>
        <p className={cn("text-body-sm text-fg-muted", !wide && "line-clamp-3")}>{industry.summary}</p>
      </div>
      <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-wide text-fg-subtle">
        {industry.projectCount > 0
          ? `${industry.projectCount} case ${industry.projectCount === 1 ? "study" : "studies"}`
          : "Capability"}
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------- post */

export function PostCard({ post, timezone }: { post: PostSummary; timezone: string }) {
  return (
    <Link
      href={`/insights/${post.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all duration-[var(--dur-base)]",
        "hover:-translate-y-1 hover:border-brand/40 hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
      )}
    >
      <Img
        media={post.cover}
        sizes="(max-width: 640px) 100vw, 33vw"
        aspect="16/10"
        className="transition-transform duration-[var(--dur-slow)] group-hover:scale-[1.03]"
      />
      <div className="flex flex-1 flex-col p-5">
        {post.topic && <Badge tone="brand" className="mb-3 self-start">{post.topic.name}</Badge>}
        <h3 className="text-h4 mb-2 text-fg transition-colors group-hover:text-brand">{post.title}</h3>
        <p className="mb-4 line-clamp-2 text-body-sm text-fg-muted">{post.excerpt}</p>
        <p className="mt-auto flex items-center gap-2 text-[0.75rem] text-fg-subtle">
          <time dateTime={post.publishedAt}>{formatDateShort(post.publishedAt, timezone)}</time>
          <span aria-hidden>·</span>
          <span>{post.readMinutes} min read</span>
        </p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------- team */

export function TeamCard({ member }: { member: TeamMember }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {member.photo && (
        <Img media={member.photo} sizes="(max-width: 640px) 50vw, 240px" aspect="1/1" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-h4 text-fg">{member.name}</h3>
        <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-wide text-brand">{member.role}</p>
        <p className="text-body-sm text-fg-muted">{member.bio}</p>
        {member.linkedinUrl && (
          <a
            href={member.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent hover:underline"
          >
            LinkedIn <ArrowRight className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}
