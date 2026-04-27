export function ObjectView({
  value,
  label,
}: {
  value: unknown;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      {label ? <p className="label-caps">{label}</p> : null}
      <pre className="max-h-[420px] overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-xs leading-6 text-on-surface-variant">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
