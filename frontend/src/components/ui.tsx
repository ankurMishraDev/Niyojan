import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function Panel({
  className,
  children,
}: PropsWithChildren<{
  className?: string;
}>) {
  return <section className={cn("panel p-4", className)}>{children}</section>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? <p className="label-caps text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {description ? (
          <p className="max-w-3xl text-[13px] leading-5 text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "action-button disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "action-button-primary",
        variant === "secondary" && "action-button-secondary",
        variant === "ghost" && "border-transparent bg-transparent text-on-surface-variant hover:text-white",
        variant === "danger" && "border-danger/70 bg-danger/15 text-danger hover:bg-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field-control", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("field-control", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field-control min-h-[120px]", className)} {...props} />;
}

export function StatusBadge({
  tone = "default",
  children,
}: PropsWithChildren<{
  tone?: "default" | "success" | "warning" | "danger";
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
        tone === "default" && "bg-surface-container-high text-on-surface-variant",
        tone === "success" && "bg-success/20 text-primary",
        tone === "warning" && "bg-warning/20 text-warning",
        tone === "danger" && "bg-danger/20 text-danger",
      )}
    >
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: ReactNode;
}) {
  return (
    <Panel className="space-y-2">
      <p className="label-caps">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <div className="text-3xl font-black text-white">{value}</div>
        {accent ? <div className="text-sm font-semibold text-primary">{accent}</div> : null}
      </div>
    </Panel>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="flex min-h-[150px] flex-col items-center justify-center gap-3 text-center">
      <p className="text-xl font-bold text-white">{title}</p>
      <p className="max-w-lg text-sm text-on-surface-variant">{description}</p>
      {action}
    </Panel>
  );
}

export function LoaderBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <Panel className="flex min-h-[120px] items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
        <p className="text-sm text-on-surface-variant">{label}</p>
      </div>
    </Panel>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
      <span>{message}</span>
      {onRetry ? (
        <button className="font-bold uppercase tracking-[0.14em] text-danger" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}
