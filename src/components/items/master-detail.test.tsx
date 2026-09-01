import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { MasterDetail, type MasterDetailItem } from "./master-detail";

const ITEMS: MasterDetailItem[] = [
  { id: "alpha", label: "alpha", state: "enabled" },
  { id: "beta", label: "beta", state: "disabled" },
  { id: "gamma", label: "gamma", state: "archived" },
];

function renderList(props: Partial<Parameters<typeof MasterDetail>[0]> = {}) {
  return render(
    <MasterDetail
      items={ITEMS}
      showArchived={false}
      empty="Nothing here."
      {...props}
    >
      <p>Detail</p>
    </MasterDetail>
  );
}

describe("MasterDetail", () => {
  test("holds archived items out of the listing until they are asked for", () => {
    renderList();
    expect(screen.queryByRole("link", { name: /gamma/ })).toBeNull();

    renderList({ showArchived: true });
    expect(screen.getByRole("link", { name: /gamma/ })).toBeInTheDocument();
  });

  test("offers a way to see the archived ones, counted", () => {
    renderList();
    expect(
      screen.getByRole("link", { name: "Show archived (1)" })
    ).toBeInTheDocument();
  });

  test("selection and the archived filter travel in the URL", () => {
    renderList({ showArchived: true });
    expect(screen.getByRole("link", { name: /alpha/ })).toHaveAttribute(
      "href",
      "?item=alpha&archived=1"
    );
  });

  test("marks the selected item for assistive technology", () => {
    renderList({ selectedId: "beta" });
    expect(screen.getByRole("link", { name: /beta/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  test("says so when there is nothing to list", () => {
    render(
      <MasterDetail items={[]} showArchived={false} empty="Nothing here.">
        <p>Detail</p>
      </MasterDetail>
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  test("offers a way back to the list when an item is selected, keeping the archived filter", () => {
    renderList({ selectedId: "beta", showArchived: true });
    expect(screen.getByRole("link", { name: "All items" })).toHaveAttribute(
      "href",
      "?archived=1"
    );
  });

  test("offers no way back when nothing is selected", () => {
    renderList();
    expect(screen.queryByRole("link", { name: "All items" })).toBeNull();
  });
});
