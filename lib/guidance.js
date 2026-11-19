/**
 * Model-facing guidance for the configured subagent types.
 * Pure module — no cordis, no IO: the Host hands in the live roster, the tests
 * hand in fixtures, and both render through this function.
 *
 * The roster itself is the same for every agent; only the management sentence
 * is main-agent-only, because the `*_subagent_type` tools are registered for
 * top-level sessions and a delegated child cannot call them.
 */

/** One-line route label for prompts and tool output. */
export function routeLabel(type) {
  return `${type.provider}/${type.model}${type.reasoningEffort === undefined ? '' : ` (effort: ${type.reasoningEffort})`}`
}

/**
 * Assemble the guidance section text.
 *
 * The origin test is negative on purpose (same rule as the job-context
 * section): the session header carries `origin` only for children, and a
 * diagnostic assembly carries no agent at all — both must keep the main-agent
 * text verbatim.
 * @param {object[]} types - roster in display order.
 * @param {string} defaultType - type id untyped delegation paths fall back to.
 * @param {string|undefined} origin - session header origin ('subagent' for children).
 * @returns {string} section text, or '' when no types are configured.
 */
export function guidanceText(types, defaultType, origin) {
  if (types.length === 0) return ''
  const lines = types.map(type => (
    `- \`${type.id}\` — ${routeLabel(type)}${type.readonly ? ', read-only (mutation tools denied)' : ''}. ${type.description}`
  ))
  const out = [
    '## Subagent types',
    'Typed delegation tools start children on a fixed model, independent of your current model. Prefer them for role-shaped work:',
    ...lines,
    `Other delegation paths (\`subagent\`, \`subagent_fork\`, \`delegate_sync\`, workflow) also start children on the default type's model (\`${defaultType}\`). Explicit model overrides on those paths (the \`subagent\` model arguments, workflow \`agent()\` provider/model) are ignored: the type registry is the only model authority. Use a typed tool to choose a different route.`,
  ]
  // Children see the roster and the delegation rules, not the management
  // instructions: those tools deny them at execution time (top-level only).
  if (origin !== 'subagent') {
    out.push('Manage types with `list_subagent_types`, `create_subagent_type`, `update_subagent_type`, `delete_subagent_type` (top-level sessions only), or in the Agent Organization panel in the left sidebar. Type changes apply to children started afterwards.')
  }
  return out.join('\n')
}
