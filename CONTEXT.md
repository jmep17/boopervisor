# Boopervisor

A local web interface for reading and editing Claude Code's on-disk configuration:
settings, skills, plugins and MCP servers. Claude Code has no configuration API, so
every concept here is grounded in files on the user's machine.

## Configuration

**Scope**:
One of the places Claude Code reads configuration from: user, project, project-local,
or managed. A setting may be present in several scopes at once.
_Avoid_: Level, tier, location

**Precedence**:
The fixed order in which scopes override one another. Managed wins over project-local,
which wins over project, which wins over user.
_Avoid_: Priority, override order

**Effective value**:
The value a given setting resolves to once precedence has been applied across all scopes.
_Avoid_: Merged value, final value, computed value

**Winning scope**:
The scope that supplied the effective value for a setting.
_Avoid_: Source, owner

**Setting**:
A single named key Claude Code reads from a settings file, together with its type,
allowed values and documentation.
_Avoid_: Option, preference, config, flag

**Catalog**:
Boopervisor's hand-maintained description of every documented setting. It is what the
interface renders forms from, and is the reason an unset setting is still discoverable.
_Avoid_: Schema, registry, manifest

**Unknown key**:
A key present in a settings file that the catalog does not describe. Boopervisor never
removes or rewrites one.
_Avoid_: Unrecognised setting, orphan key

## Items

**Item**:
Anything Boopervisor lists and toggles rather than edits as a value: a skill, a plugin,
or an MCP server. Items have state; settings have values.
_Avoid_: Entity, resource, extension, component

**Enabled**:
An item Claude Code will load and use.
_Avoid_: Active, on, installed

**Disabled**:
An item Claude Code knows about but will not load, expressed through Claude Code's own
mechanism for that item type.
_Avoid_: Off, inactive, paused, suspended

**Archived**:
An item Boopervisor hides from the main listing and holds disabled. Archival is
Boopervisor's own concept, recorded in Boopervisor's own file; Claude Code has no such
state and the item's own files are never moved or altered.
_Avoid_: Deleted, removed, hidden, shelved, retired

**Item state**:
Exactly one of enabled, disabled, or archived.
_Avoid_: Status, mode

## Writing

**Mutation**:
A single user-initiated change that Boopervisor writes to disk.
_Avoid_: Edit, update, transaction, operation

**Stale write**:
A mutation whose target file changed on disk after Boopervisor read it. Boopervisor
refuses these rather than overwriting a change it never saw.
_Avoid_: Conflict, race, dirty write

**Backup**:
A timestamped copy of a file taken immediately before a mutation touches it.
_Avoid_: Snapshot, revision, checkpoint

**Restore**:
Returning a file to the contents of one of its backups. Itself a mutation, and so
itself backed up.
_Avoid_: Revert, rollback, undo
