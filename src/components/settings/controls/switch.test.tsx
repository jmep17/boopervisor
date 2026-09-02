import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Field } from "@/components/ui/field";
import { SwitchControl } from "./switch";

describe("SwitchControl", () => {
  test("shows On for true", () => {
    render(
      <Field label="Verbose">
        <SwitchControl value={true} />
      </Field>
    );
    expect(screen.getByLabelText("Verbose")).toHaveTextContent("On");
  });

  test("shows Off for false", () => {
    render(
      <Field label="Verbose">
        <SwitchControl value={false} />
      </Field>
    );
    expect(screen.getByLabelText("Verbose")).toHaveTextContent("Off");
  });

  test("shows Not set for an unset key", () => {
    render(
      <Field label="Verbose">
        <SwitchControl value={undefined} />
      </Field>
    );
    expect(screen.getByLabelText("Verbose")).toHaveTextContent("Not set");
  });

  test("submits under the name value", () => {
    // Radix renders its native field only inside a form, which is where the control lives.
    const { container } = render(
      <form>
        <SwitchControl value={true} />
      </form>
    );
    expect(container.querySelector('[name="value"]')).not.toBeNull();
  });
});
