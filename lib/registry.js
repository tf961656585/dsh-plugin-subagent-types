/**
 * Type registry: the single source of truth for subagent types and their
 * model routes. Storage-backed CRUD with config seeding; the Host wiring,
 * management tools, prompt guidance, and routing all read from here.
 *
 * The table adapter is the storage-domain KvTable surface
 * (get/entries/put/delete); tests supply an in-memory fake.
 */
import { normalizeType, typeProblems } from './contract.js'

export class TypeRegistry {
  /**
   * @param {object} table - KvTable-compatible record store.
   * @param {object} options
   * @param {string} options.defaultType - fallback type id for untyped children.
   * @param {object[]} options.seeds - config-declared initial types (create-if-absent).
   */
  constructor(table, { defaultType, seeds = [] }) {
    this.table = table
    this.defaultType = defaultType
    this.seeds = seeds
  }

  /** Create seed types that do not exist yet; never overwrite stored edits. */
  async init() {
    for (const seed of this.seeds) {
      const problems = typeProblems(seed)
      if (problems.length > 0) throw new Error(`seed type "${seed?.id}" invalid: ${problems.join('; ')}`)
      if (this.table.get(seed.id) === undefined) {
        await this.table.put(seed.id, normalizeType(seed))
      }
    }
    if (this.table.get(this.defaultType) === undefined) {
      throw new Error(`default type "${this.defaultType}" does not exist after seeding`)
    }
  }

  /** One type, or undefined. */
  get(id) {
    return this.table.get(id)
  }

  /** All types in insertion order. */
  list() {
    return [...this.table.entries()].map(([, value]) => value)
  }

  /** Plain map id → type for the routing decision. */
  map() {
    const out = {}
    for (const [id, value] of this.table.entries()) out[id] = value
    return out
  }

  /**
   * Create one type. Validation only; route existence is preflighted by the
   * Host against the live LLM runtime before calling this.
   */
  async create(input) {
    const problems = typeProblems(input)
    if (problems.length > 0) throw new Error(`invalid type: ${problems.join('; ')}`)
    if (this.table.get(input.id) !== undefined) throw new Error(`type "${input.id}" already exists`)
    const type = normalizeType(input)
    await this.table.put(type.id, type)
    return type
  }

  /**
   * Update one type. A route change must name provider and model together;
   * an omitted effort clears the stored effort (adapter default applies).
   */
  async update(id, patch) {
    const current = this.table.get(id)
    if (current === undefined) throw new Error(`type "${id}" does not exist`)
    const next = { ...current }
    if (patch.description !== undefined) next.description = patch.description
    if (patch.readonly !== undefined) next.readonly = patch.readonly
    const routeTouched = patch.provider !== undefined || patch.model !== undefined
    if (routeTouched) {
      if (patch.provider === undefined || patch.model === undefined) {
        throw new Error('a route change must supply provider and model together')
      }
      next.provider = patch.provider
      next.model = patch.model
    }
    if (Object.hasOwn(patch, 'reasoningEffort')) {
      if (patch.reasoningEffort === undefined || patch.reasoningEffort === null || patch.reasoningEffort === '') {
        delete next.reasoningEffort
      } else {
        next.reasoningEffort = patch.reasoningEffort
      }
    }
    const problems = typeProblems(next)
    if (problems.length > 0) throw new Error(`invalid type: ${problems.join('; ')}`)
    const normalized = normalizeType(next)
    await this.table.put(id, normalized)
    return normalized
  }

  /** Delete one type; the default type cannot be deleted. */
  async remove(id) {
    if (id === this.defaultType) throw new Error(`cannot delete the default type "${id}"`)
    if (this.table.get(id) === undefined) throw new Error(`type "${id}" does not exist`)
    await this.table.delete(id)
  }
}