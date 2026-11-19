# dsh-plugin-subagent-types

Agent organization for DeepSeek Harness. One left-sidebar panel, **Agent
Organization**, manages two things for the whole profile:

- the **main agent's job description** — free text written into the main agent's
  system prompt;
- the **subagent types** — each type is a named delegation policy: one fixed
  model route + a read-only flag + role guidance. A type is **not** an agent
  preset; children inherit the parent's harness runtime, and the session preset
  roster stays untouched.

## The panel

Left sidebar → **Agent Organization** (settings-card management on the Plugins
page was retired in favor of this panel).

**Block A — Main agent**

- Editor for the job description with a live character count (the ceiling comes
  from the Host), an unsaved marker, and an explicit **Save**. Saving reports
  "Saved; takes effect on the next reply" — the next model request already
  carries the text, no restart and no new session needed. Clearing the text
  stops the section from being injected.
- Injection preview: the exact frame + text the model will read, marked as
  draft while it differs from what is stored. Empty text explains that the
  section is not injected at all.
- **Verify injection** runs a diagnostic prompt assembly and reports one of
  three states: injected, not injected (with a retry), or no description
  written yet (a normal state — an empty section is dropped by design).
- Persona weights: one 0–100 slider per reader identity, with the brief /
  medium / full band the weight selects (0 injects nothing). A drag saves by
  itself, and the preview is the exact persona text the model will read.

**Block B — Subagent team**

- Default type (the fallback for delegation that does not name a type) and the
  type list: id, full model route, read-only or writable, default marker, and
  the description.
- Create and edit form in one column: the id is typed only on create, the
  description is required, provider → model → reasoning effort cascade (a
  change resets the narrower choices). The route picker reads the live LLM
  catalog, and every write is validated server-side before it lands.
- Delete takes two steps. The default type cannot be deleted — switch the
  default first; the panel says so.

Everything above is also reachable from chat tools for types (`list_subagent_types`,
`create_subagent_type`, `update_subagent_type`, `delete_subagent_type`, top-level
sessions only). The job description is user-only on purpose: no model tool writes it.

## Installation

Requires [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Install this bundle from the DSH plugin installer and enter this repository's
address (a local absolute path works too). Reload the window after installing;
the panel appears in the left sidebar as **Agent Organization**. Client JS is
loaded dynamically with no build step, so later client-only edits show up on a
refresh; Host JS changes need an application restart (or a remove + install).

## Config (cordis.patch.yml)

```yaml
config:
  defaultType: worker        # fallback type for untyped delegation paths
  types:                     # create-if-absent seeds; stored edits always win
    - id: explore
      description: ...
      provider: magpie
      model: opencode-go/deepseek-v4.1-flash
      readonly: true
```

The seeds only apply when storage has no record yet; anything edited in the
panel wins.

## What it does at runtime

- **Typed delegation tools** — one `@deepseek-ai/dsh-tool-subagent` instance per
  type (`toolName` = type id), dynamically mounted with `agentOptions` pinning
  the route. `explore` and `worker` are seeded by config; more types can be
  created at runtime.
- **Full-path routing** — an `agent/created` listener pins every fresh untyped
  subagent child (shipped `subagent`/`subagent_fork` tools, `delegate_sync`,
  workflow) to the default type's route. Explicit route overrides (the
  `subagent` tool's model arguments, workflow `agent()` provider/model) are
  ignored: the type registry is the only model authority. Resume/compact keep
  recorded selections.
- **Per-child policy** — typed children are identified by a spawn-time
  async-context marker set in the around-dispatch `tools/execute` waterfall;
  the listener attaches the type's persona section and, for read-only types,
  an execution guard on the child's own context. Read-only is enforced by
  deterministic denial of `bash`/`write`/`edit`/`apply_patch` — the tools stay
  visible in the inherited catalog but calls are denied.
- **Job description injection** — one global section, recomputed every step, so
  a saved edit lands on the next reply. Children never receive it; subagents
  keep the type persona and the delegation rules only.
- **User persona injection** — the weights render one persona section (highest
  weight leads, the rest add one line each) into every assembly, delegated
  children included. The section text is the retired user-persona plugin's,
  byte for byte; that plugin's weights file is imported once, when this profile
  has no weights stored yet, and is otherwise read-only.
- **Single source of truth** — routes live in the storage-domain registry
  (`subagent_types` domain) and the job text in the `agent_context` domain;
  tool instances and prompt sections are mounted from those.

## Routes

Same-origin routes behind the panel:

| Route | Purpose |
|---|---|
| `GET /plugin/subagent-types/state` | types, default type, job text + ceiling + frame, persona weights + presets + bands + preview |
| `GET /plugin/subagent-types/models` | live provider/model catalog (and one provider's efforts) |
| `GET /plugin/subagent-types/verify` | diagnostic assembly: is the job section injected? |
| `POST /plugin/subagent-types/mutate` | `create` / `update` / `delete` / `setDefault` / `setContext` / `setPersonaWeights` |

## Known effects

- Type ids must not collide with existing tool names; shipped delegation and
  control names are reserved.
- Read-only children still see mutation tools in their inherited catalog;
  calls are denied with a type-named reason. Catalog-level removal would
  require agent presets, which this plugin deliberately does not register.
- Type changes apply to children started afterwards; running children keep
  their policy.
- The job description applies to the main agent only. A child's prompt carries
  the type persona and the delegation rules, never this text.

## Tests

```sh
node --test test/*.test.mjs
```
