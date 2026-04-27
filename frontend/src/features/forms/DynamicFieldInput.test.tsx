import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DynamicFieldInput } from "@/features/forms/DynamicFieldInput";

describe("DynamicFieldInput", () => {
  it("updates text fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DynamicFieldInput
        field={{ id: "field-1", inputType: "text", options: null }}
        value={{ inputType: "text", valueText: "" }}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByRole("textbox"), "Sector 7G");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders select options and emits selected value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DynamicFieldInput
        field={{ id: "field-2", inputType: "select", options: ["water", "food"] }}
        value={{ inputType: "select", valueText: "" }}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox"), "food");
    expect(onChange).toHaveBeenCalledWith({
      inputType: "select",
      valueText: "food",
      valueJson: "food",
    });
  });
});
