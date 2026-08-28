import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Checkbox } from "./checkbox";
import { Field } from "./field";
import { Switch } from "./switch";

describe("Switch", () => {
  test("reports its state through the field's label", () => {
    render(
      <Field label="Include co-authored-by">
        <Switch defaultChecked />
      </Field>,
    );
    expect(screen.getByLabelText("Include co-authored-by")).toBeChecked();
  });

  test("is unchecked by default", () => {
    render(
      <Field label="Verbose">
        <Switch />
      </Field>,
    );
    expect(screen.getByLabelText("Verbose")).not.toBeChecked();
  });
});

describe("Checkbox", () => {
  test("reports its state through the field's label", () => {
    render(
      <Field label="Archived">
        <Checkbox defaultChecked />
      </Field>,
    );
    expect(screen.getByLabelText("Archived")).toBeChecked();
  });
});
