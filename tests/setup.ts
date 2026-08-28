import { afterEach, expect } from "bun:test";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// React 19 warns unless test code declares itself an `act` environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

expect.extend(matchers);

afterEach(cleanup);
