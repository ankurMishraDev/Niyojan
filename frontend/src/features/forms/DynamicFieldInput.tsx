import { Input, Select, Textarea } from "@/components/ui";
import { sentence } from "@/lib/format";

export type DynamicFieldValue = {
  inputType: string;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueJson?: unknown;
};

export function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: {
    id: string;
    inputType: string;
    options: unknown;
  };
  value: DynamicFieldValue | undefined;
  onChange: (value: Partial<DynamicFieldValue>) => void;
}) {
  const options = Array.isArray(field.options) ? (field.options as string[]) : [];

  if (field.inputType === "textarea") {
    return (
      <Textarea
        value={value?.valueText ?? ""}
        onChange={(event) => onChange({ inputType: field.inputType, valueText: event.target.value })}
      />
    );
  }

  if (field.inputType === "number") {
    return (
      <Input
        type="number"
        value={value?.valueNumber ?? ""}
        onChange={(event) =>
          onChange({
            inputType: field.inputType,
            valueNumber: event.target.value ? Number(event.target.value) : undefined,
          })
        }
      />
    );
  }

  if (field.inputType === "boolean") {
    return (
      <Select
        value={String(value?.valueBool ?? false)}
        onChange={(event) =>
          onChange({
            inputType: field.inputType,
            valueBool: event.target.value === "true",
          })
        }
      >
        <option value="false">No</option>
        <option value="true">Yes</option>
      </Select>
    );
  }

  if (field.inputType === "select") {
    return (
      <Select
        value={value?.valueText ?? ""}
        onChange={(event) =>
          onChange({
            inputType: field.inputType,
            valueText: event.target.value,
            valueJson: event.target.value,
          })
        }
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {sentence(option)}
          </option>
        ))}
      </Select>
    );
  }

  if (field.inputType === "multiselect") {
    return (
      <Textarea
        placeholder="Enter comma-separated values"
        value={Array.isArray(value?.valueJson) ? (value?.valueJson as string[]).join(", ") : ""}
        onChange={(event) =>
          onChange({
            inputType: field.inputType,
            valueJson: event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          })
        }
      />
    );
  }

  return (
    <Input
      type={field.inputType === "date" ? "date" : "text"}
      value={value?.valueText ?? ""}
      onChange={(event) => onChange({ inputType: field.inputType, valueText: event.target.value })}
    />
  );
}
