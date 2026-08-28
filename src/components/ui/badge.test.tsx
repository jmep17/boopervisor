import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  test("renders its text", () => {
    render(<Badge>Uncatalogued</Badge>);
    expect(screen.getByText("Uncatalogued")).toBeInTheDocument();
  });

  test("carries no colour of its own outside the token layer", () => {
    const { container } = render(<Badge tone="warning">Managed</Badge>);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
