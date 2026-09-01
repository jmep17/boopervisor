import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { SettingRow } from "./setting-row";

/** Compact JSON with no space to break at, as `permissions` looks in a real file. */
const LONG_VALUE = {
  allow: Array.from(
    { length: 12 },
    (_, i) => `Bash(git ${"subcommand".repeat(i + 1)}:*)`
  ),
};

function renderRow() {
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
    renderRow();
    const summaryValue = screen.getAllByTitle(JSON.stringify(LONG_VALUE))[0];
    expect(summaryValue).toHaveClass("truncate");
    expect(summaryValue).toHaveClass("min-w-0");
  });

  test("lets a value in the breakdown break anywhere", () => {
    renderRow();
    const breakdownValue = screen.getByText(JSON.stringify(LONG_VALUE), {
      selector: "dd",
    });
    expect(breakdownValue).toHaveClass("break-all");
  });
});
