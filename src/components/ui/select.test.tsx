import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Field } from "./field";
import { Select, SelectItem } from "./select";

describe("Select", () => {
  test("shows its placeholder while nothing is chosen", () => {
    render(
      <Field label="Output style">
        <Select placeholder="Not set">
          <SelectItem value="default">default</SelectItem>
          <SelectItem value="explanatory">explanatory</SelectItem>
        </Select>
      </Field>
    );
    const trigger = screen.getByLabelText("Output style");
    expect(trigger).toHaveRole("combobox");
    expect(trigger).toHaveTextContent("Not set");
  });

  test("shows the chosen value", () => {
    render(
      <Field label="Output style">
        <Select defaultValue="explanatory" placeholder="Not set">
          <SelectItem value="default">default</SelectItem>
          <SelectItem value="explanatory">explanatory</SelectItem>
        </Select>
      </Field>
    );
    expect(screen.getByLabelText("Output style")).toHaveTextContent(
      "explanatory"
    );
  });
});

describe("Select outside a Field", () => {
  test("takes its accessible name from aria-label", () => {
    render(
      <Select aria-label="Scope" defaultValue="user">
        <SelectItem value="user">User</SelectItem>
      </Select>
    );
    expect(screen.getByRole("combobox", { name: "Scope" })).toHaveTextContent(
      "User"
    );
  });
});

describe("Select with a given value label", () => {
  test("shows the label without waiting for its items to mount", () => {
    render(
      <Select
        aria-label="Scope"
        value="project:/x/api"
        valueLabel="api"
        onValueChange={() => {}}
      >
        <SelectItem value="user">User</SelectItem>
      </Select>
    );
    expect(screen.getByRole("combobox", { name: "Scope" })).toHaveTextContent(
      "api"
    );
  });
});
