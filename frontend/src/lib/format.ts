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

  if (["Approved", "Published", "Completed", "Resolved", "Available", "Open", "Active"].includes(status)) {
    return "success" as const;
  }

  if (["Critical", "Failed", "Rejected", "Cancelled", "Escalated", "Unresolved"].includes(status)) {
    return "danger" as const;
  }

  if (["Processing", "Pending", "Review Pending", "High", "In Progress", "Matched", "Assigned"].includes(status)) {
    return "warning" as const;
  }

  return "default" as const;
};