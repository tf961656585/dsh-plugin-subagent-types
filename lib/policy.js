/**
 * Per-child policy carried by one type: role guidance and the read-only
 * execution guard. Pure module; the Host registers these on the child's
 * own context at agent/created, so they apply to that child only.
 *
 * Read-only is enforced at execution time (deterministic denial), not by
 * removing tools from the catalog: the child inherits the parent's harness
 * runtime, and tool restrictions cannot remove inherited preset-scoped tools.
 */

/** Mutation tools denied to read-only types. */
export const READONLY_DENIED_TOOLS = ['bash', 'write', 'edit', 'apply_patch']

/** Persona prefix seeding the child's role behavior. */
export function personaText(type) {
  const base = `You are a delegated subagent of type "${type.id}". ${type.description}`
  if (type.readonly) {
    return `${base} You are read-only: mutation tools (bash, write, edit, apply_patch) are denied at execution time. Investigate with the read and search tools, change nothing, and return your findings as a distilled report with file paths and line numbers as evidence.`
  }
  return `${base} Carry out the delegated task with the tools you have, verify your own work before finishing, and return a distilled result — what you did, what you verified, and what remains.`
}

/** The execution guard for a read-only type; undefined for writable types. */
export function guardFor(type) {
  if (!type.readonly) return undefined
  return (exec) => {
    if (!READONLY_DENIED_TOOLS.includes(exec.name)) return undefined
    return `type "${type.id}" is read-only: \`${exec.name}\` is denied. Use the read and search tools, and report findings instead of changing anything.`
  }
}