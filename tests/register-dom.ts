// Registers a DOM on the global scope. Must run before anything that touches
// `document` is imported, so it lives in its own preload file.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}
