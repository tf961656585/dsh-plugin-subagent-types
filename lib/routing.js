/**
 * The routing decision for one freshly created child agent.
 * Pure module: the Host listener supplies facts, this module decides.
 *
 * Policy (user decisions 2026-11-17/18; closure A 2026-11-18):
 * - A type is a delegation policy, not an agent preset. Typed children are
 *   identified by the spawn-time context marker (the type tool's name);
 *   their model is already pinned by the tool instance's agentOptions.
 * - Only fresh subagent children are touched; resume/compact/clear keep their
 *   recorded selection.
 * - The type registry is the sole model authority. Every untyped fresh child
 *   (shipped subagent/fork tools, delegate_sync, workflow) is pinned to the
 *   default type's route. Explicit route overrides — the subagent tool's
 *   model arguments and workflow agent() provider/model — are NOT honored:
 *   no child inherits the parent's model or escapes the configured types.
 */
import { sameRoute } from './contract.js'

/**
 * @param {object} input
 * @param {string} input.source - SessionStartSource of the agent/created event.
 * @param {string|undefined} input.origin - session header origin ('subagent' for children).
 * @param {string|undefined} input.typeId - spawn-time type marker, when a type tool spawned the child.
 * @param {Object<string, object>} input.types - type map by id.
 * @param {string} input.defaultType - fallback type id.
 * @returns {{action:'skip', reason:string} | {action:'apply', type:object, pinModel:boolean, basis:'typed'|'default'}}
 */
export function decideChildPolicy(input) {
  const { source, origin, typeId, types, defaultType } = input
  if (source !== 'startup') return { action: 'skip', reason: 'not-fresh' }
  if (origin !== 'subagent') return { action: 'skip', reason: 'not-subagent' }

  const typed = typeId !== undefined ? types[typeId] : undefined
  if (typed !== undefined) {
    // The type tool's agentOptions already pinned the route; only attach policy.
    return { action: 'apply', type: typed, pinModel: false, basis: 'typed' }
  }

  // Sole model authority: every untyped fresh child pins to the default type,
  // regardless of any explicit route override the spawning path requested.
  const type = types[defaultType]
  if (type === undefined) return { action: 'skip', reason: 'no-default-type' }
  return { action: 'apply', type, pinModel: true, basis: 'default' }
}

/**
 * The model selection to record for a default-routed child. When the pinned
 * route equals the inherited one, keep the inherited effort unless the type
 * names its own; a route change always drops the parent's effort.
 */
export function selectionFor(type, childOptions = {}) {
  const route = { provider: type.provider, model: type.model }
  const effort = type.reasoningEffort
    ?? (sameRoute(route, childOptions) ? childOptions.reasoningEffort : undefined)
  return { ...route, ...(effort === undefined ? {} : { reasoningEffort: effort }) }
}