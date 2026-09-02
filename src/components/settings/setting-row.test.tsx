import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getSetting } from "@/lib/catalog";
import type { EffectiveValue } from "@/lib/config/effective";
import {
  SettingRow,
  type SettingRowProps,
  type WriteSettingAction,
} from "./setting-row";

/** Compact JSON with no space to break at, as `permissions` looks in a real file. */
const LONG_VALUE = {
  allow: Array.from(
    { length: 12 },
    (_, i) => `Bash(git ${"subcommand".repeat(i + 1)}:*)`
  ),
};

function renderLongValueRow() {
  return render(
    <SettingRow
      effective={{
        key: "permissions",
        effectiveValue: LONG_VALUE,
        winningScope: "user",
        perScope: { user: LONG_VALUE },
      }}
      editing="user"
      expected="not-a-real-snapshot"
      readOnly={false}
    />
  );
}

describe("SettingRow", () => {
  test("keeps a long effective value to one line, with the whole value on hover", () => {
    renderLongValueRow();
    const summaryValue = screen.getAllByTitle(JSON.stringify(LONG_VALUE))[0];
    expect(summaryValue).toHaveClass("truncate");
    expect(summaryValue).toHaveClass("min-w-0");
  });

  test("lets a value in the breakdown break anywhere", () => {
    renderLongValueRow();
    const breakdownValue = screen.getByText(JSON.stringify(LONG_VALUE), {
      selector: "dd",
    });
    expect(breakdownValue).toHaveClass("break-all");
  });
});

const PLAIN = getSetting("plansDirectory")!;
const DANGEROUS = getSetting("apiKeyHelper")!;

function renderRow(
  props: Partial<SettingRowProps> & { action: WriteSettingAction }
) {
  const definition = props.definition ?? PLAIN;
  const effective: EffectiveValue = props.effective ?? {
    key: definition.key,
    effectiveValue: undefined,
    winningScope: "user",
    perScope: {},
  };
  return render(
    <SettingRow
      definition={definition}
      effective={effective}
      editing="user"
      expected="tok"
      readOnly={false}
      options={{}}
      {...props}
    />
  );
}

describe("SettingRow: saving, unsetting and confirming", () => {
  test("saves through the action with key, scope, expected and value", async () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({ action });

    await userEvent.type(screen.getByRole("textbox"), "/tmp/plans");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [[, formData]] = action.mock.calls;
    expect(formData.get("key")).toBe("plansDirectory");
    expect(formData.get("scope")).toBe("user");
    expect(formData.get("expected")).toBe("tok");
    expect(formData.get("value")).toBe("/tmp/plans");
    expect(formData.get("unset")).toBeNull();

    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });

  test("unsets through the Unset button", async () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({
      action,
      effective: {
        key: "plansDirectory",
        effectiveValue: "/old",
        winningScope: "user",
        perScope: { user: "/old" },
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Unset" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [[, formData]] = action.mock.calls;
    expect(formData.get("unset")).toBe("1");
  });

  test("shows what the server said", async () => {
    const action = mock<WriteSettingAction>(async () => ({
      error: "That file changed on disk.",
    }));
    renderRow({ action });

    await userEvent.type(screen.getByRole("textbox"), "/tmp/plans");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That file changed on disk."
    );
  });

  test("asks before writing a dangerous key and writes only after Write it", async () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({ action, definition: DANGEROUS });

    await userEvent.type(screen.getByRole("textbox"), "/bin/helper");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByRole("dialog", { name: "Write apiKeyHelper?" })
    ).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Write it" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [[, formData]] = action.mock.calls;
    expect(formData.get("value")).toBe("/bin/helper");
    expect(formData.get("unset")).toBeNull();
  });

  test("Enter in a dangerous row opens the dialog instead of writing", async () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({ action, definition: DANGEROUS });

    const textbox = screen.getByRole("textbox");
    await userEvent.type(textbox, "/bin/helper");
    fireEvent.submit(screen.getByRole("form", { name: "Edit apiKeyHelper" }));

    expect(
      screen.getByRole("dialog", { name: "Write apiKeyHelper?" })
    ).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  test("unsetting a dangerous key also asks, then removes the key", async () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({
      action,
      definition: DANGEROUS,
      effective: {
        key: "apiKeyHelper",
        effectiveValue: "/bin/old",
        winningScope: "user",
        perScope: { user: "/bin/old" },
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Unset" }));

    expect(
      screen.getByRole("dialog", { name: "Write apiKeyHelper?" })
    ).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Write it" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [[, formData]] = action.mock.calls;
    expect(formData.get("unset")).toBe("1");
  });

  test("hides Saved once the value is edited again", async () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({ action });

    await userEvent.type(screen.getByRole("textbox"), "/tmp/plans");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");

    await userEvent.type(screen.getByRole("textbox"), "x");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("shows the new value when the file's value changes", () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    const { rerender } = renderRow({
      action,
      effective: {
        key: "plansDirectory",
        effectiveValue: "/one",
        winningScope: "user",
        perScope: { user: "/one" },
      },
    });

    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "/one-x" } });

    rerender(
      <SettingRow
        definition={PLAIN}
        effective={{
          key: "plansDirectory",
          effectiveValue: "/two",
          winningScope: "user",
          perScope: { user: "/two" },
        }}
        editing="user"
        expected="tok"
        readOnly={false}
        options={{}}
        action={action}
      />
    );

    expect(screen.getByRole("textbox")).toHaveValue("/two");
  });

  test("managed rows have no form", () => {
    const action = mock<WriteSettingAction>(async () => ({ ok: true }));
    renderRow({ action, readOnly: true });

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/Boopervisor only reads them/)).toBeInTheDocument();
  });
});
