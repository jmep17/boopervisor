# 05: Remaining typed controls

**What to build:** Every catalog key becomes editable with a control that matches its type, not a text box. Enumerated string keys get a dropdown, keys with suggested-but-open values get a combobox, numbers get a number control, string arrays get a list editor, and a key that is present as one fixed string or absent gets a literal toggle. `sandbox`, `env` and `pluginConfigs` get a validated JSON editor, which is enough until they prove they need more. Option lists that only exist on the user's machine — models, output styles, themes — are resolved when the control renders.

**Blocked by:** 04 (Write one setting end to end).

**Status:** ready-for-agent

- [ ] Every non-virtual catalog key renders the control its definition names.
- [ ] Any key with a closed set of allowed values is a dropdown, never free text.
- [ ] The list editor adds, edits, reorders and removes entries and writes a well-formed array.
- [ ] The JSON editor refuses to submit invalid JSON, and refuses a value the catalog rejects.
- [ ] Machine-local option sources are read at render time and degrade to free entry when unavailable.
- [ ] Every control writes through the same validated, backed-up, stale-checked path as ticket 04.
