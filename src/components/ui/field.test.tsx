import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Field } from "./field";
import { Input } from "./input";
import { Textarea } from "./textarea";

describe("Field", () => {
  test("labels the control it wraps", () => {
    render(
      <Field label="Model">
        <Input defaultValue="opus" />
      </Field>,
    );
    expect(screen.getByLabelText("Model")).toHaveValue("opus");
  });

  test("describes the control with its description", () => {
    render(
      <Field label="Model" description="Which model Claude Code starts with.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Model")).toHaveAccessibleDescription(
      "Which model Claude Code starts with.",
    );
  });

  test("marks the control invalid and announces the error", () => {
    render(
      <Field label="Model" error="Not a documented model.">
        <Input />
      </Field>,
    );
    const control = screen.getByLabelText("Model");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Not a documented model.");
    expect(screen.getByRole("alert")).toHaveTextContent("Not a documented model.");
  });

  test("works for any control that reads the field, not just Input", () => {
    render(
      <Field label="Environment" description="JSON object.">
        <Textarea />
      </Field>,
    );
    expect(screen.getByLabelText("Environment").tagName).toBe("TEXTAREA");
  });

  test("leaves an explicitly given id alone", () => {
    render(
      <Field label="Model">
        <Input id="model-input" />
      </Field>,
    );
    expect(screen.getByLabelText("Model")).toHaveAttribute("id", "model-input");
  });
});
