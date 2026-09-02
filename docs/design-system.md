# Design system

Vercel's Geist — https://vercel.com/geist/introduction. Vercel publishes fonts but no React
component package, so Boopervisor keeps three things of its own:

- **Fonts.** Geist Sans and Geist Mono from the `geist` npm package, applied in
  `src/app/layout.tsx` as the `--font-geist-sans` / `--font-geist-mono` variables that the
  Tailwind theme's `--font-sans` and `--font-mono` point at. `@geist-ui/react` is an
  unaffiliated, archived community library and is not used.
- **Tokens.** `src/app/globals.css` holds Geist's colour, radius and shadow values,
  transcribed by hand, then exposes them as Tailwind theme values. Tailwind's own palette is
  cleared in the same `@theme` block, so every colour utility is a Geist token by
  construction. Tailwind drops a class it cannot resolve silently rather than failing, so
  `src/app/design-tokens.test.ts` scans every component for a colour or radius class the
  theme does not define.
- **Controls.** `src/components/ui/` — shadcn/ui's shape, built on Radix primitives, styled
  only from the token layer.

The judgement above the tokens — typography roles, restraint, copy, motion,
accessibility — is `DESIGN.md` at the repo root, Vercel's own design.md with
a note on what applies to a product interface.

## Where the token values came from

Extracted 2026-08-28 from Vercel's own published stylesheets, not retyped from screenshots:

| What                                                   | Source                                                                     |
| :----------------------------------------------------- | :------------------------------------------------------------------------- |
| Colour scales, all ten steps, light and dark           | the `--ds-*` custom properties served with https://vercel.com/geist/colors |
| Step meanings (400 is a border, 900 is secondary text) | https://vercel.com/geist/colors                                            |
| Radii and shadow names                                 | https://vercel.com/geist/materials                                         |
| Shadow values                                          | the `--ds-shadow-*` custom properties on the same stylesheet               |

Light and dark are one `light-dark()` pair per token, so each value is written once and
`color-scheme` picks the half. `:root` follows the operating system; `.light` and `.dark` on
the document element override it.

Geist can change under us — the same drift ADR 0003 accepts for the settings catalog. The
mitigation is the same: the values live in one file, with this note saying where to look.
