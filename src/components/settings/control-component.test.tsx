import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SETTINGS, type Control } from "@/lib/catalog";
import { ControlComponent } from "./control-component";

const controls: Control[] = [
  "switch",
  "select",
  "combobox",
  "text",
  "number",
  "stringList",
  "literalToggle",
  "json",
  "permissionRules",
  "hooks",
  "envMap",
];

describe("ControlComponent", () => {
  for (const control of controls) {
    test(`renders the ${control} control`, () => {
      const definition = SETTINGS.find(
        (setting) => setting.control === control
      );
      expect(definition).toBeDefined();
      const { container } = render(
        <ControlComponent definition={definition} value={undefined} />
      );

      if (
        control === "switch" ||
        control === "select" ||
        control === "combobox"
      ) {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      } else if (control === "text") {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      } else if (control === "number") {
        expect(screen.getByRole("spinbutton")).toBeInTheDocument();
      } else if (
        control === "stringList" ||
        control === "permissionRules" ||
        control === "hooks" ||
        control === "envMap"
      ) {
        expect(
          container.querySelector('input[type="hidden"][name="value"]')
        ).not.toBeNull();
      } else if (control === "literalToggle") {
        expect(screen.getByRole("checkbox")).toBeInTheDocument();
      } else {
        expect(screen.getByRole("textbox")).toHaveClass("font-mono");
      }
    });
  }

  test("uses a JSON textbox when no definition is known", () => {
    render(<ControlComponent value={undefined} />);
    expect(screen.getByRole("textbox")).toHaveClass("font-mono");
  });

  test("prefers machine options over catalog suggestions", async () => {
    const user = userEvent.setup();
    const definition = SETTINGS.find((setting) => setting.key === "model");
    expect(definition).toBeDefined();
    render(
      <ControlComponent
        definition={definition}
        value={undefined}
        options={{ models: [{ value: "claude-x" }] }}
      />
    );

    await user.type(screen.getByRole("combobox"), "{ArrowDown}");
    expect(
      screen.getByRole("option", { name: "claude-x" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "fable" })
    ).not.toBeInTheDocument();
  });

  test("passes model suggestions to string-list entries", async () => {
    const user = userEvent.setup();
    const definition = SETTINGS.find(
      (setting) => setting.key === "fallbackModel"
    );
    expect(definition).toBeDefined();
    render(<ControlComponent definition={definition} value={["default"]} />);

    await user.type(screen.getByRole("combobox"), "{ArrowDown}");
    expect(screen.getByRole("option", { name: "opus" })).toBeInTheDocument();
  });
});
