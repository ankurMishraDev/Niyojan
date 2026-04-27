export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Not available";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-IN", options).format(value);

export const formatPercent = (value: number, digits = 0) =>
  `${(value * 100).toFixed(digits)}%`;

export const sentence = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const toneForStatus = (value?: string) => {
  const status = (value ?? "").toLowerCase();

  if (["approved", "published", "completed", "resolved", "available", "open", "active"].includes(status)) {
    return "success" as const;
  }

  if (["critical", "failed", "rejected", "cancelled", "escalated", "unresolved"].includes(status)) {
    return "danger" as const;
  }

  if (["processing", "pending", "review_pending", "high", "in_progress", "matched", "assigned"].includes(status)) {
    return "warning" as const;
  }

  return "default" as const;
};
