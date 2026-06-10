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
  return <section className={cn("panel p-6", className)}>{children}</section>;
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
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div className="space-y-2">
        {eyebrow ? <p className="label-caps text-mute">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-[15px] leading-relaxed text-body">{description}</p>
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
        variant === "ghost" && "border-transparent bg-transparent text-body hover:text-ink hover:bg-canvas-soft-2 rounded-sm",
        variant === "danger" && "action-button rounded-pill border border-danger/20 bg-danger/10 text-danger hover:bg-danger/20",
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
  return <select className={cn("field-control bg-canvas", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field-control min-h-[120px] resize-y", className)} {...props} />;
}

export function StatusBadge({
  tone = "default",
  children,
}: PropsWithChildren<{
  tone?: "default" | "success" | "warning" | "danger" | "cyan" | "violet";
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "default" && "bg-canvas-soft-2 text-body border border-hairline",
        tone === "success" && "bg-link-bg-soft/50 text-link border border-link/20",
        tone === "warning" && "bg-warning/10 text-warning-deep border border-warning/20",
        tone === "danger" && "bg-danger/10 text-danger border border-danger/20",
        tone === "cyan" && "bg-cyan/10 text-cyan-deep border border-cyan/20",
        tone === "violet" && "bg-violet/10 text-violet-deep border border-violet/20"
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
    <Panel className="space-y-4">
      <p className="label-caps">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <div className="text-4xl font-semibold tracking-tight text-ink">{value}</div>
        {accent ? <div className="text-sm font-medium text-body">{accent}</div> : null}
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
    <Panel className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center bg-canvas-soft">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="max-w-md text-sm text-body leading-relaxed">{description}</p>
      {action}
    </Panel>
  );
}

export function LoaderBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <Panel className="flex min-h-[160px] items-center justify-center">
      <div className="space-y-4 text-center flex flex-col items-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        <p className="text-sm font-medium text-mute animate-pulse">{label}</p>
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      {onRetry ? (
        <button className="font-semibold text-danger hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-danger rounded" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}
