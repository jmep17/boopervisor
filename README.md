# Boopervisor

A local web interface for Claude Code's configuration. It reads and edits the real files on
this machine — `settings.json` at every scope, `.mcp.json`, `~/.claude.json`, and the skill
and plugin directories — and shows you what Claude Code will actually do with them.

Claude Code has no configuration API. Everything here is filesystem work behind a browser UI,
which is why the server has to run locally.

## Status

Working, for a single user on one machine: settings at every scope, skills, plugins, MCP
servers and a history with restore. See `docs/PLAN.md` for the agreed design, `docs/adr/`
for the decisions that are settled, and `docs/verified-file-formats.md` for which
assumptions about Claude Code's files have been checked.

## Running

```bash
bun install
bun dev
```

Then open http://localhost:3000.

The server listens on 127.0.0.1 only: it edits files under your home directory and must not
be reachable from other machines.

## What it covers

- **Settings** — a form for every documented settings key, with a searchable picker wherever
  the key has a known set of values, showing the effective value and which scope set it; the
  `env` setting is edited variable by variable, with each one's documented purpose.
- **Skills**, **Plugins**, **MCP servers** — enable, disable or archive each one.

Anthropic's Admin API (organisation members, workspaces, API keys, spend limits) is a
different product with different authentication and is deliberately out of scope. claude.ai's
own account preferences have no public API at all and cannot be covered.

## Reading order

- `CONTEXT.md` — the vocabulary. Read this first; the terms are used precisely.
- `docs/PLAN.md` — scope, architecture and what is deferred.
- `docs/adr/` — decisions that would otherwise look arbitrary.
- `docs/settings-catalog.md` — where each catalog entry came from.
