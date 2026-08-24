"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CircleAlert } from "lucide-react";

/* ------------------------------------------------------------- FieldRow */

export interface FieldRowProps {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FieldRow({
  label, htmlFor, help, error, required, optionalLabel, className, children,
}: FieldRowProps) {
  const helpId = help ? `${htmlFor}-help` : undefined;
  const errId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-fg">
        {label}
        {required && <span className="ml-1 text-danger" aria-hidden>*</span>}
        {optionalLabel && !required && <span className="ml-1.5 font-normal text-fg-subtle">(optional)</span>}
      </label>
      {help && <p id={helpId} className="text-[0.8125rem] leading-snug text-fg-subtle">{help}</p>}
      <FieldContext.Provider value={{ id: htmlFor, describedBy: [helpId, errId].filter(Boolean).join(" ") || undefined, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

const FieldContext = React.createContext<{ id: string; describedBy?: string; invalid: boolean } | null>(null);
const useField = () => React.useContext(FieldContext);

/* --------------------------------------------------------------- inputs */

const base =
  "w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle " +
  "transition-colors duration-[var(--dur-fast)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const stateClass = (invalid?: boolean) =>
  invalid ? "border-danger focus-visible:outline-danger" : "border-border hover:border-border-strong";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) {
    const f = useField();
    return (
      <input
        ref={ref}
        id={p.id ?? f?.id}
        aria-describedby={p["aria-describedby"] ?? f?.describedBy}
        aria-invalid={p["aria-invalid"] ?? (f?.invalid || undefined)}
        className={cn(base, stateClass(f?.invalid), "h-11", className)}
        {...p}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 5, ...p }, ref) {
    const f = useField();
    return (
      <textarea
        ref={ref}
        rows={rows}
        id={p.id ?? f?.id}
        aria-describedby={p["aria-describedby"] ?? f?.describedBy}
        aria-invalid={p["aria-invalid"] ?? (f?.invalid || undefined)}
        className={cn(base, stateClass(f?.invalid), "resize-y leading-relaxed", className)}
        {...p}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...p }, ref) {
    const f = useField();
    return (
      <div className="relative">
        <select
          ref={ref}
          id={p.id ?? f?.id}
          aria-describedby={p["aria-describedby"] ?? f?.describedBy}
          aria-invalid={p["aria-invalid"] ?? (f?.invalid || undefined)}
          className={cn(base, stateClass(f?.invalid), "h-11 appearance-none pr-10", className)}
          {...p}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
          viewBox="0 0 16 16" fill="none" aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  },
);

/* ------------------------------------------------------- choice controls */

export interface ChoiceProps {
  id: string;
  name?: string;
  value: string;
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  type?: "checkbox" | "radio";
}

export function Choice({
  id, name, value, label, description, checked, defaultChecked, onChange, type = "checkbox",
}: ChoiceProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3.5",
        "transition-colors duration-[var(--dur-fast)] hover:border-border-strong hover:bg-bg-subtle",
        "has-[:checked]:border-brand has-[:checked]:bg-teal-50/70 dark:has-[:checked]:bg-teal-900/30",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-ring)]",
      )}
    >
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
        className={cn(
          "mt-0.5 size-[1.15rem] shrink-0 cursor-pointer accent-[var(--color-brand)]",
          type === "checkbox" ? "rounded" : "rounded-full",
        )}
      />
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium leading-snug text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}
