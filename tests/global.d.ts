import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare global {
  // Set by `tests/setup.ts`; React 19 warns without it.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// `tests/setup.ts` extends bun's expect with jest-dom's matchers. Both interfaces
// exist only to merge those matchers in, so both are deliberately empty.
declare module "bun:test" {
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  interface Matchers<T> extends TestingLibraryMatchers<never, T> {}
  interface AsymmetricMatchers extends TestingLibraryMatchers<never, void> {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}

export {};
