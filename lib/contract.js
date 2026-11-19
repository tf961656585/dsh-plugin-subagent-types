/**
 * Subagent type contract: identity, validation, and naming rules.
 * Pure module — no cordis, no IO. The Host wiring, the management tools,
 * and the tests all validate through the same functions.
 *
 * A type is a delegation policy (model route + read-only flag + guidance),
 * NOT an agent preset: children inherit the parent's harness runtime.
 */

/** Type ids double as model-facing tool names. */
export const TYPE_ID_RE = /^[a-z][a-z0-9-]{0,31}$/

/**
 * Names a type must not take: shipped delegation and control tools.
 * Preset-scoped tools shadow same-named global tools, so a type reusing one
 * of these names would register a tool nobody can see in standard sessions.
 */
export const RESERVED_TOOL_NAMES = new Set([
  'subagent', 'subagent_fork', 'delegate_sync', 'list_subagent_models',
  'send_message', 'list_agents', 'wait_agent',
  'job_list', 'job_output', 'job_kill',
])

/**
 * Validate one type definition (create, update result, or config seed).
 * @returns {string[]} human-readable problems; empty when valid.
 */
export function typeProblems(t) {
  const problems = []
  if (typeof t !== 'object' || t === null) return ['type must be an object']
  if (typeof t.id !== 'string' || !TYPE_ID_RE.test(t.id)) {
    problems.push('id must match /^[a-z][a-z0-9-]{0,31}$/ (lowercase letters, digits, hyphens; starts with a letter; at most 32 chars)')
  }
  if (typeof t.description !== 'string' || t.description.trim() === '') {
    problems.push('description must be a non-empty string (it tells the main agent when to use this type)')
  }
  if (typeof t.provider !== 'string' || t.provider.trim() === '') problems.push('provider must be a non-empty string')
  if (typeof t.model !== 'string' || t.model.trim() === '') problems.push('model must be a non-empty string')
  if (t.reasoningEffort !== undefined && (typeof t.reasoningEffort !== 'string' || t.reasoningEffort.trim() === '')) {
    problems.push('reasoningEffort, when present, must be a non-empty string')
  }
  if (typeof t.readonly !== 'boolean') problems.push('readonly must be a boolean')
  return problems
}

/** Trim string fields and drop an absent effort; does not validate. */
export function normalizeType(t) {
  const out = {
    id: t.id,
    description: t.description.trim(),
    provider: t.provider.trim(),
    model: t.model.trim(),
    readonly: t.readonly,
  }
  if (t.reasoningEffort !== undefined) out.reasoningEffort = t.reasoningEffort.trim()
  return out
}

/** The LLM route one type pins its children to. */
export function routeOf(type) {
  return {
    provider: type.provider,
    model: type.model,
    ...(type.reasoningEffort === undefined ? {} : { reasoningEffort: type.reasoningEffort }),
  }
}

/** Route equality ignoring reasoning effort. */
export function sameRoute(a, b) {
  return a !== undefined && b !== undefined && a.provider === b.provider && a.model === b.model
}