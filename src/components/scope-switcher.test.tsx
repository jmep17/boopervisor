import { describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mergeProjectPaths, USER_SCOPE } from "@/lib/scope/scope";
import {
  AddProjectForm,
  ScopeSwitcherView,
  type AddProjectFormProps,
} from "./scope-switcher";

const PROJECTS = mergeProjectPaths(["/Users/x/src/api"], ["/Users/x/work/web"]);

const noop = () => {};

describe("ScopeSwitcherView", () => {
  test("shows the user scope when it is selected", () => {
    render(
      <ScopeSwitcherView
        selected={USER_SCOPE}
        projects={PROJECTS}
        onSelect={noop}
        onAddProject={noop}
      />
    );
    expect(screen.getByRole("combobox", { name: "Scope" })).toHaveTextContent(
      "User"
    );
  });

  test("shows the selected project", () => {
    render(
      <ScopeSwitcherView
        selected={{ kind: "project", path: "/Users/x/work/web" }}
        projects={PROJECTS}
        onSelect={noop}
        onAddProject={noop}
      />
    );
    expect(screen.getByRole("combobox", { name: "Scope" })).toHaveTextContent(
      "web"
    );
  });
});

describe("AddProjectForm", () => {
  test("reports what the server said about the directory", async () => {
    const action = mock<AddProjectFormProps["action"]>(async () => ({
      error: "No such directory.",
    }));
    const onAdded = mock(() => {});
    render(<AddProjectForm action={action} onAdded={onAdded} />);

    await userEvent.type(screen.getByLabelText("Directory"), "/nope");
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No such directory."
    );
    expect(onAdded).not.toHaveBeenCalled();
    // The rejected path is the one worth correcting, so it stays in the field.
    expect(screen.getByLabelText("Directory")).toHaveValue("/nope");
  });

  test("closes the picker once the directory is accepted", async () => {
    const action = mock<AddProjectFormProps["action"]>(async () => ({}));
    const onAdded = mock(() => {});
    render(<AddProjectForm action={action} onAdded={onAdded} />);

    await userEvent.type(
      screen.getByLabelText("Directory"),
      "/Users/x/src/api"
    );
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    const [[, formData]] = action.mock.calls;
    expect(formData.get("path")).toBe("/Users/x/src/api");
  });
});
