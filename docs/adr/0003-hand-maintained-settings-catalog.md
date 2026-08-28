# The settings catalog is hand-maintained in the repo

Claude Code documents roughly 125 settings keys, but publishes no machine-readable schema.
The catalog — one entry per key, with its type, allowed values, default, applicable scopes
and documentation link — is written by hand as a TypeScript module in `src/lib/catalog/`,
populated by a deliberate research pass over the published settings reference and recorded
in `docs/settings-catalog.md`.

Scraping the documentation at build time was the obvious alternative and breaks the first
time the docs restructure, in a way that fails the build rather than degrading. It also
leaves nowhere to hang the things only we know: which control renders a key, how to group
it, which keys are dangerous enough to warrant a confirmation.

Inferring the form from whatever JSON already exists on disk was the other alternative, and
it can only ever show the user settings they have already set. Discovering settings you did
not know existed is most of the point of the application, so the catalog has to be able to
describe a key that appears nowhere on the machine.

The consequence is a maintenance burden: when Claude Code adds a setting, Boopervisor does
not know about it until someone updates the catalog. Unknown keys found on disk are surfaced
in the interface as uncatalogued rather than hidden, which turns that gap into something the
user can see, and are always written back untouched.
