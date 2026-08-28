# 01: App shell in Geist tokens

**What to build:** Boopervisor opens on a browsable shell that already looks like the finished product. The create-next-app boilerplate is gone. Geist's colour, spacing, radius and shadow tokens are transcribed into the Tailwind theme, Geist Sans and Geist Mono come from the `geist` npm package, and the shared control set (button, field, dialog, and the other primitives the later tickets edit settings with) is built on shadcn/ui's Radix primitives restyled to match. A header navigates between `/settings`, `/skills`, `/plugins`, `/mcp` and `/history`, each of which renders an empty page for now.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] `src/app/page.tsx`, `layout.tsx` and `globals.css` carry no create-next-app content.
- [x] Geist tokens are available as Tailwind theme values, not hardcoded hex in components.
- [x] Geist Sans and Geist Mono load from the `geist` package. `@geist-ui/react` is not a dependency.
- [x] The five routes exist and the header navigates between them, with the current route marked.
- [x] The shared controls render in isolation and are used by the header, so the token layer is proven rather than asserted.
