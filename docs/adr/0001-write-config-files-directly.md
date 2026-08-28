# Write configuration files directly instead of shelling out to the `claude` CLI

Claude Code exposes CLI surfaces for some of what Boopervisor manages (`claude mcp add`,
`claude mcp remove`, `claude plugin marketplace add`), and those commands are by definition
authoritative about their own file formats. We still write the files ourselves.

Shelling out costs us a subprocess per mutation, gives us no dry-run, and turns failures
into stdout we have to parse. It also cannot express the things Boopervisor is actually for:
a preview of what will change, a backup taken immediately before the write, and a refusal
when the file moved under us. None of that is reachable through a CLI that owns the write.

The cost is real and we accept it: our understanding of `settings.json`, `.mcp.json` and
`~/.claude.json` can drift from Claude Code's. The mitigation is that the file-format
knowledge lives in one module with tests that operate on a temporary directory, so drift
shows up as a failing test rather than a corrupted config.
