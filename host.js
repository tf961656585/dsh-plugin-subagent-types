/**
 * Subagent types — Host half.
 *
 * A type is a named delegation POLICY: one model route + a read-only flag +
 * role guidance. It is not an agent preset — children inherit the parent's
 * harness runtime, and the session preset roster stays untouched.
 *
 * Each type becomes a model-facing delegation tool (a dynamically mounted
 * `@deepseek-ai/dsh-tool-subagent` instance whose agentOptions pin the route).
 * A spawn-time async-context marker (set in the around-dispatch tools/execute
 * waterfall) identifies typed children; an `agent/created` listener attaches
 * the type's per-child policy (persona section + read-only execution guard)
 * and pins untyped children from every other delegation path (shipped
 * subagent/fork tools, delegate_sync, workflow) to the default type's route.
 * The type registry is the sole model authority: explicit route overrides
 * (the subagent tool's model arguments, workflow agent() provider/model) are
 * not honored — no child inherits the parent's model or escapes the types.
 *
 * The type registry (storage-domain backed) is the single source of truth.
 * The same operations serve the model-facing management tools (top-level
 * agents only) and the same-origin routes behind the Agent Organization
 * panel (left sidebar) — the only management surface.
 *
 * The plugin also owns the main agent's job context: one user-written text,
 * stored globally (`agent_context` domain) and injected as a prompt section
 * into every main-agent assembly, never into a delegated child.
 *
 * And it owns the user persona: the weights of five reader identities, stored
 * globally (`user_persona` domain), rendered by `lib/persona.js` into the same
 * section the retired `dsh-user-persona` plugin injected, and injected into
 * every assembly — main agent and delegated children alike.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { homedir } from 'node:os'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent'
import { z } from 'zod'
import { TypeRegistry } from './lib/registry.js'
import { decideChildPolicy, selectionFor } from './lib/routing.js'
import { guardFor, personaText } from './lib/policy.js'
import { RESERVED_TOOL_NAMES, routeOf, typeProblems } from './lib/contract.js'
import { guidanceText } from './lib/guidance.js'
import {
  CONTEXT_FRAME, CONTEXT_MAX_LENGTH, contextProblems, normalizeContextText, renderContextSection,
} from './lib/context.js'
import {
  PERSONA_BANDS, PERSONA_MAX_WEIGHT, PERSONA_PRESETS, normalizePersonaWeights, personaWeightProblems,
  renderPersona,
} from './lib/persona.js'

export const name = 'subagent-types'
export const inject = ['tools', 'subagents', 'systemPrompt', 'storageDomain', 'llm']

const ROUTE_BASE = '/plugin/subagent-types'
const MAX_BODY_BYTES = 64 * 1024
/** Persona section identity. Namespaced: a duplicate name in one layer throws, and the retired plugin's bare name is not reused. */
const PERSONA_SECTION_NAME = 'agent-organization:persona'
/** The slot the retired user-persona plugin used: after the deployment persona (0), before plan policy. */
const PERSONA_SECTION_ORDER = 20
/** Job-context section identity. Namespaced for the same reason. */
const CONTEXT_SECTION_NAME = 'agent-organization:context'
/** Right after the persona (20), before plan policy. */
const CONTEXT_SECTION_ORDER = 30

/** Durable record schema for one type (storage-domain validates at the boundary). */
const typeRecordSchema = z.object({
  id: z.string(),
  description: z.string(),
  provider: z.string(),
  model: z.string(),
  reasoningEffort: z.string().optional(),
  readonly: z.boolean(),
})

/** Spawn-time type marker: the type tool's name flows to agent/created. */
const spawnContext = new AsyncLocalStorage()

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

function sendMethodNotAllowed(res, allow) {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * The retired user-persona plugin's weights file, resolved in the order it used
 * (profile directory, harness home, then ~/.dsh). Read only: the file stays
 * where it is, as a manual rollback, and is never written or deleted here.
 */
function legacyPersonaFile() {
  const profile = process.env.DSH_PROFILE_DIR
  if (typeof profile === 'string' && profile !== '') return path.join(profile, 'user-persona.json')
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home !== '') return path.join(home, 'user-persona.json')
  return path.join(homedir(), '.dsh', 'user-persona.json')
}

/**
 * Prove the job-context section really reaches prompt assembly: assemble the
 * diagnostic prompt (no agent — that is also why the origin filter is
 * negative) and read this plugin's own section back.
 *
 * `injected` requires the section to carry text: the renderer drops empty
 * entries, and a preset-owned `complete` section would replace every other
 * section. `configured` separates "the stored text is empty" from "the section
 * is not reaching the prompt", which look the same from `injected` alone.
 */
async function verifyContextSection(ctx, storedText) {
  const result = {
    injected: false,
    name: CONTEXT_SECTION_NAME,
    length: 0,
    configured: normalizeContextText(storedText) !== '',
  }
  const systemPrompt = ctx.systemPrompt
  if (typeof systemPrompt?.assemble !== 'function') return { ...result, reason: 'systemPrompt service unavailable' }
  try {
    const assembly = await systemPrompt.assemble({})
    const section = assembly.sections.find((entry) => entry.name === CONTEXT_SECTION_NAME)
    const text = typeof section?.text === 'string' ? section.text : ''
    return { ...result, injected: text !== '', length: text.length }
  } catch (error) {
    return { ...result, reason: String(error?.message ?? error) }
  }
}

export async function apply(ctx, config = {}) {
  const configDefault = typeof config.defaultType === 'string' && config.defaultType !== '' ? config.defaultType : 'worker'
  const seeds = Array.isArray(config.types) ? config.types : []
  for (const seed of seeds) {
    const problems = typeProblems(seed)
    if (problems.length > 0) throw new Error(`subagent-types: config seed invalid: ${problems.join('; ')}`)
    if (RESERVED_TOOL_NAMES.has(seed.id)) throw new Error(`subagent-types: seed id "${seed.id}" is a reserved tool name`)
  }
  if (seeds.length > 0 && !seeds.some(seed => seed.id === configDefault)) {
    throw new Error(`subagent-types: defaultType "${configDefault}" must be one of the configured seed types`)
  }

  const domain = await ctx.storageDomain.open({
    name: 'subagent_types',
    version: 1,
    global: { schema: z.object({ defaultType: z.string() }), initial: { defaultType: configDefault } },
    tables: { types: { valueSchema: typeRecordSchema } },
  })
  ctx.effect(() => () => domain.close(), 'subagent-types: domain')
  // A stored default (set from the page) wins over the deployment config.
  const registry = new TypeRegistry(domain.table('types'), { defaultType: domain.global.get().defaultType, seeds })
  await registry.init()

  // ---- main-agent job context storage ----
  // Its own domain: `subagent_types` has no migration path, so a second table
  // there would need a hand-written v2 migration. The domain keeps the global
  // in memory, so the prompt text function below reads it synchronously.
  const contextDomain = await ctx.storageDomain.open({
    name: 'agent_context',
    version: 1,
    global: { schema: z.object({ text: z.string() }), initial: { text: '' } },
    // Declared (empty) because the domain layer dereferences the table map.
    tables: {},
  })
  ctx.effect(() => () => contextDomain.close(), 'subagent-types: context domain')

  /** Stored job context; throwing on a closed or failed domain is the honest answer. */
  const storedContextText = () => contextDomain.global.get().text
  // A prompt text function must never break assembly: report the first failure
  // once, then keep contributing nothing instead of throwing every step.
  let contextReadFailure
  const sectionContextText = () => {
    try {
      return storedContextText()
    } catch (error) {
      const message = String(error?.message ?? error)
      if (contextReadFailure !== message) {
        contextReadFailure = message
        ctx.logger.warn(`subagent-types: job context unavailable: ${message}`)
      }
      return ''
    }
  }
  /** What the routes return: the text plus what the panel needs to preview it. */
  const contextSnapshot = () => ({
    text: storedContextText(),
    maxLength: CONTEXT_MAX_LENGTH,
    frame: CONTEXT_FRAME,
  })

  // ---- user persona weights storage ----
  // Its own domain too: the persona has nothing to do with the type registry,
  // and the retired plugin's file is only a one-time import source.
  const personaDomain = await ctx.storageDomain.open({
    name: 'user_persona',
    version: 1,
    global: { schema: z.object({ weights: z.record(z.string(), z.number()) }), initial: { weights: {} } },
    // Declared (empty) for the same reason as above.
    tables: {},
  })
  ctx.effect(() => () => personaDomain.close(), 'subagent-types: persona domain')

  /**
   * Adopt the retired plugin's weights exactly once. Create-if-absent: this runs
   * only while this profile has no weights stored and never again afterwards, so
   * a later slider edit can never be overwritten by the stale file. An
   * unreadable file is the normal case on a fresh install; anything else (bad
   * JSON aside) is logged and the profile simply starts empty.
   */
  const importLegacyWeights = async () => {
    if (Object.keys(personaDomain.global.get().weights).length > 0) return
    const file = legacyPersonaFile()
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'))
      const weights = normalizePersonaWeights(raw?.weights)
      if (Object.keys(weights).length === 0) return
      await personaDomain.global.set({ weights })
      ctx.logger.info(`subagent-types: imported persona weights from ${file}`)
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        ctx.logger.warn(`subagent-types: cannot import persona weights from ${file}: ${String(error)}`)
      }
    }
  }
  await importLegacyWeights()

  /** Stored persona weights; throwing on a closed or failed domain is honest. */
  const storedPersonaWeights = () => personaDomain.global.get().weights
  // Same rule as the job text: a prompt text function must never break assembly.
  let personaReadFailure
  const sectionPersonaWeights = () => {
    try {
      return storedPersonaWeights()
    } catch (error) {
      const message = String(error?.message ?? error)
      if (personaReadFailure !== message) {
        personaReadFailure = message
        ctx.logger.warn(`subagent-types: persona weights unavailable: ${message}`)
      }
      return {}
    }
  }
  /**
   * What the routes return: the weights in canonical shape, plus everything the
   * panel needs to label the sliders and show the injection. The preview is the
   * rendered section text itself, so the panel cannot drift from the injection.
   */
  const personaSnapshot = () => {
    const weights = normalizePersonaWeights(storedPersonaWeights())
    return {
      weights,
      presets: PERSONA_PRESETS.map(preset => ({ id: preset.id, name: preset.label, tagline: preset.tagline })),
      bands: PERSONA_BANDS.map(band => ({ id: band.id, min: band.min, max: band.max })),
      maxWeight: PERSONA_MAX_WEIGHT,
      preview: renderPersona(weights),
    }
  }

  // ---- dynamic mounts: one delegation tool per type, route pinned ----
  const mounts = new Map()
  const mountType = async (type) => {
    const fiber = ctx.plugin(toolSubagent, {
      provider: 'spawn',
      toolName: type.id,
      agentOptions: routeOf(type),
      modelSelection: false,
      modelDiscovery: false,
    })
    await fiber
    mounts.set(type.id, { disposeTool: () => fiber.dispose() })
  }
  const unmountType = async (id) => {
    const mount = mounts.get(id)
    if (mount === undefined) return
    mounts.delete(id)
    try { await mount.disposeTool() } catch (error) { ctx.logger.warn(`subagent-types: disposing tool ${id}: ${String(error)}`) }
  }
  for (const type of registry.list()) await mountType(type)
  ctx.effect(() => async () => {
    for (const id of [...mounts.keys()]) await unmountType(id)
  }, 'subagent-types: mounts')

  // ---- shared operations: management tools and page routes call these ----
  const preflightRoute = async (provider, model, reasoningEffort, signal) => {
    await ctx.llm.resolveCallConfig({
      provider,
      model,
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    }, signal)
  }
  const operations = {
    async create(input, signal) {
      const id = input?.id
      if (RESERVED_TOOL_NAMES.has(id)) throw new Error(`type id "${id}" is a reserved tool name`)
      if (ctx.tools.get(id) !== undefined) throw new Error(`a tool named "${id}" already exists`)
      const type = {
        id,
        description: input?.description,
        provider: input?.provider,
        model: input?.model,
        readonly: input?.readonly ?? false,
        ...(input?.reasoningEffort === undefined || input?.reasoningEffort === null || input?.reasoningEffort === ''
          ? {} : { reasoningEffort: input.reasoningEffort }),
      }
      const problems = typeProblems(type)
      if (problems.length > 0) throw new Error(`invalid type: ${problems.join('; ')}`)
      await preflightRoute(type.provider, type.model, type.reasoningEffort, signal)
      const created = await registry.create(type)
      await mountType(created)
      return created
    },
    async update(id, patch, signal) {
      const current = registry.get(id)
      if (current === undefined) throw new Error(`type "${id}" does not exist`)
      const routeChanged = patch.provider !== undefined
        && (patch.provider !== current.provider || patch.model !== current.model)
      if (routeChanged || Object.hasOwn(patch, 'reasoningEffort')) {
        const nextProvider = patch.provider ?? current.provider
        const nextModel = patch.model ?? current.model
        const nextEffort = Object.hasOwn(patch, 'reasoningEffort')
          ? (patch.reasoningEffort === '' || patch.reasoningEffort === null ? undefined : patch.reasoningEffort)
          : current.reasoningEffort
        await preflightRoute(nextProvider, nextModel, nextEffort, signal)
      }
      const updated = await registry.update(id, patch)
      if (routeChanged) {
        await unmountType(updated.id)
        await mountType(updated)
      }
      return updated
    },
    async delete(id) {
      await unmountType(id)
      await registry.remove(id)
      return { deleted: id }
    },
    async setDefault(id) {
      if (registry.get(id) === undefined) throw new Error(`type "${id}" does not exist`)
      await domain.global.set({ defaultType: id })
      registry.defaultType = id
      return { defaultType: id }
    },
    async setContext(text) {
      const problems = contextProblems(text)
      if (problems.length > 0) throw new Error(`invalid context: ${problems.join('; ')}`)
      await contextDomain.global.set({ text: normalizeContextText(text) })
      return contextSnapshot()
    },
    async setPersonaWeights(weights) {
      const problems = personaWeightProblems(weights)
      if (problems.length > 0) throw new Error(`invalid weights: ${problems.join('; ')}`)
      await personaDomain.global.set({ weights: normalizePersonaWeights(weights) })
      return personaSnapshot()
    },
  }

  // ---- spawn-time type marker for typed delegation tools ----
  // tools/execute is the around-dispatch waterfall wrapping the tool body
  // (pre-execute only decides admission); the marker must cover the body so
  // it flows through startActivation into agent/created.
  ctx.on('tools/execute', (exec, next) => {
    if (registry.get(exec.name) !== undefined) return spawnContext.run(exec.name, () => next())
    return next()
  })

  // ---- per-child policy: model pin for untyped paths, persona + guard ----
  const childPolicies = new Map()
  ctx.on('agent/created', ({ agent, source }) => {
    try {
      const header = agent.session.header
      const decision = decideChildPolicy({
        source,
        origin: header.origin,
        typeId: spawnContext.getStore(),
        types: registry.map(),
        defaultType: registry.defaultType,
      })
      if (decision.action === 'skip') return
      const type = decision.type
      if (decision.pinModel && typeof agent.model?.select === 'function') {
        agent.model.select(selectionFor(type, agent.options ?? {}))
      }
      const childCtx = agent.ctx
      const dispose = childCtx.effect(() => {
        const offPersona = childCtx.systemPrompt.section({
          name: 'subagent-type:persona',
          order: childCtx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
          text: personaText(type),
        })
        const guard = guardFor(type)
        const offGuard = guard === undefined ? undefined : childCtx.tools.guard(guard)
        return () => { offPersona(); offGuard?.() }
      }, `subagent-types: policy ${agent.id}`)
      childPolicies.set(agent.id, dispose)
    } catch (error) {
      ctx.logger.warn(`subagent-types: policy for child ${agent.id}: ${String(error)}`)
    }
  })
  ctx.on('agent/disposed', ({ agent }) => { childPolicies.delete(agent.id) })
  ctx.effect(() => () => {
    for (const dispose of childPolicies.values()) {
      try { dispose() } catch { /* already unwound with the agent */ }
    }
    childPolicies.clear()
  }, 'subagent-types: child policies')

  // ---- management tools (top-level agents only) ----
  const assertTopLevel = (exec) => {
    if (exec.agent?.session.header.origin === 'subagent') {
      throw new Error('subagent type management is only available to top-level agents')
    }
  }
  const jsonOutput = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }
  const registerTool = (definition) => ctx.effect(() => ctx.tools.register(definition), `subagent-types: tool ${definition.name}`)

  registerTool({
    name: 'list_subagent_types',
    description: 'List the configured subagent types: each type\'s id, description, model route, read-only flag, and the default type used by untyped delegation paths.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: jsonOutput,
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      assertTopLevel(exec)
      return JSON.stringify({ defaultType: registry.defaultType, types: registry.list() }, null, 2)
    },
  })

  registerTool({
    name: 'create_subagent_type',
    description: 'Create one subagent type: a named delegation tool with a fixed model route. The id becomes the tool name (lowercase letters, digits, hyphens). Read-only types deny mutation tools at execution time. The route is validated against the live LLM providers before creation.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Type id and tool name: /^[a-z][a-z0-9-]{0,31}$/; must not collide with an existing tool.' },
        description: { type: 'string', description: 'When the main agent should use this type; seeds the child persona.' },
        provider: { type: 'string', description: 'Registered LLM provider id.' },
        model: { type: 'string', description: 'Exact model id within that provider.' },
        reasoning_effort: { type: 'string', description: 'Optional reasoning effort id; omission uses the model default.' },
        readonly: { type: 'boolean', description: 'True denies bash/write/edit/apply_patch for this type\'s children. Default false.' },
      },
      required: ['id', 'description', 'provider', 'model'],
    },
    output: jsonOutput,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      assertTopLevel(exec)
      const created = await operations.create({
        id: args?.id,
        description: args?.description,
        provider: args?.provider,
        model: args?.model,
        readonly: args?.readonly,
        reasoningEffort: args?.reasoning_effort,
      }, exec.signal)
      return JSON.stringify(created, null, 2)
    },
  })

  registerTool({
    name: 'update_subagent_type',
    description: 'Update one subagent type. A route change must supply provider and model together and is validated live; reasoning_effort set to empty clears it. Changes apply to children started afterwards.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Existing type id.' },
        description: { type: 'string', description: 'New usage description.' },
        provider: { type: 'string', description: 'New provider id; requires model.' },
        model: { type: 'string', description: 'New model id; requires provider.' },
        reasoning_effort: { type: 'string', description: 'New effort id; empty string clears the stored effort.' },
        readonly: { type: 'boolean', description: 'New read-only flag.' },
      },
      required: ['id'],
    },
    output: jsonOutput,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      assertTopLevel(exec)
      const patch = {}
      if (args.description !== undefined) patch.description = args.description
      if (args.readonly !== undefined) patch.readonly = args.readonly
      if (args.provider !== undefined || args.model !== undefined) {
        patch.provider = args.provider
        patch.model = args.model
      }
      if (args.reasoning_effort !== undefined) patch.reasoningEffort = args.reasoning_effort
      const updated = await operations.update(args?.id, patch, exec.signal)
      return JSON.stringify(updated, null, 2)
    },
  })

  registerTool({
    name: 'delete_subagent_type',
    description: 'Delete one subagent type: removes its delegation tool. The default type cannot be deleted. Children already running keep their policy.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { id: { type: 'string', description: 'Type id to delete.' } },
      required: ['id'],
    },
    output: jsonOutput,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      assertTopLevel(exec)
      return JSON.stringify(await operations.delete(args?.id), null, 2)
    },
  })

  // ---- prompt guidance ----
  // The roster is shared by every agent, but the management sentence is
  // main-agent-only: the `*_subagent_type` tools deny children. A diagnostic
  // assembly (no agent) keeps the full text.
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'subagent-types',
    order: ctx.systemPrompt.getSectionOrder('TOOL_SUBAGENT') + 1,
    text: (context) => guidanceText(
      registry.list(),
      registry.defaultType,
      context?.agent?.session?.header?.origin,
    ),
  }), 'subagent-types: prompt section')

  // ---- main-agent job context: one global section, children excluded ----
  // Registered once on the plugin context (not per agent), so one save reaches
  // every main-agent assembly. The text function re-reads storage on each
  // assembly: an edit applies to the next model request, and empty text drops
  // the section without unregistering it.
  ctx.effect(() => ctx.systemPrompt.section({
    name: CONTEXT_SECTION_NAME,
    order: CONTEXT_SECTION_ORDER,
    interpolate: false,
    text: (context) => renderContextSection(sectionContextText(), context?.agent?.session?.header?.origin),
  }), 'subagent-types: context section')

  // ---- user persona: one global section, children included ----
  // The question "who am I writing for" holds for every reader, delegated
  // children included, so this one has no origin filter — the opposite of the
  // job context above. Weights re-render per assembly, so a slider change lands
  // on the next model request.
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SECTION_NAME,
    order: PERSONA_SECTION_ORDER,
    interpolate: false,
    text: () => renderPersona(sectionPersonaWeights()),
  }), 'subagent-types: persona section')

  // ---- same-origin routes for the Agent Organization panel ----
  ctx.inject(['webServer'], (web) => {
    web.effect(() => {
      const rejectionOf = (req, res) => {
        const connection = ctx.get('connection')
        if (connection === undefined || typeof connection.requestRejection !== 'function') return false
        const rejection = connection.requestRejection(req)
        if (rejection === undefined) return false
        res.statusCode = rejection
        res.end()
        return true
      }
      const disposers = [
        web.webServer.register({
          kind: 'exact',
          path: `${ROUTE_BASE}/state`,
          handler: async (req, res) => {
            if (rejectionOf(req, res)) return
            if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
            sendJson(res, 200, {
              defaultType: registry.defaultType,
              types: registry.list(),
              context: contextSnapshot(),
              persona: personaSnapshot(),
            })
          },
        }),
        web.webServer.register({
          kind: 'exact',
          path: `${ROUTE_BASE}/verify`,
          handler: async (req, res) => {
            if (rejectionOf(req, res)) return
            if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
            try {
              sendJson(res, 200, await verifyContextSection(ctx, storedContextText()))
            } catch (error) {
              sendJson(res, 500, {
                injected: false,
                name: CONTEXT_SECTION_NAME,
                length: 0,
                configured: false,
                reason: String(error?.message ?? error),
              })
            }
          },
        }),
        web.webServer.register({
          kind: 'exact',
          path: `${ROUTE_BASE}/models`,
          handler: async (req, res) => {
            if (rejectionOf(req, res)) return
            if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
            try {
              const url = new URL(String(req.url ?? '/'), 'http://localhost')
              const providerId = url.searchParams.get('provider')
              if (providerId === null || providerId === '') {
                const providers = ctx.llm.listProviders().map(provider => ({ id: provider.id, name: provider.name }))
                return sendJson(res, 200, { providers })
              }
              const catalog = await ctx.llm.listModels(providerId)
              // listModels carries only id/name; reasoning efforts live on the
              // resolved exact-route metadata, so resolve each model for them.
              const models = await Promise.all(catalog.map(async (model) => {
                let efforts = []
                let defaultEffort
                try {
                  const info = await ctx.llm.resolveModelInfo(providerId, model.id)
                  efforts = (info.reasoning?.efforts ?? []).map(effort => ({ id: effort.id, name: effort.name }))
                  defaultEffort = info.reasoning?.defaultEffort
                } catch { /* an unresolvable model still lists, just without effort options */ }
                return { id: model.id, name: model.name, efforts, defaultEffort }
              }))
              sendJson(res, 200, { provider: providerId, models })
            } catch (error) {
              sendJson(res, 400, { error: String(error?.message ?? error) })
            }
          },
        }),
        web.webServer.register({
          kind: 'exact',
          path: `${ROUTE_BASE}/mutate`,
          handler: async (req, res) => {
            if (rejectionOf(req, res)) return
            if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
            let body
            try {
              body = JSON.parse(await readBody(req))
            } catch {
              return sendJson(res, 400, { error: 'request body is not valid JSON' })
            }
            try {
              const action = body?.action
              if (action === 'create') {
                return sendJson(res, 200, { ok: true, type: await operations.create(body, undefined) })
              }
              if (action === 'update') {
                const patch = {}
                if (body.description !== undefined) patch.description = body.description
                if (body.readonly !== undefined) patch.readonly = body.readonly
                if (body.provider !== undefined || body.model !== undefined) {
                  patch.provider = body.provider
                  patch.model = body.model
                }
                if (Object.hasOwn(body, 'reasoningEffort')) patch.reasoningEffort = body.reasoningEffort
                return sendJson(res, 200, { ok: true, type: await operations.update(body.id, patch, undefined) })
              }
              if (action === 'delete') {
                return sendJson(res, 200, { ok: true, ...(await operations.delete(body.id)) })
              }
              if (action === 'setDefault') {
                return sendJson(res, 200, { ok: true, ...(await operations.setDefault(body.id)) })
              }
              if (action === 'setContext') {
                return sendJson(res, 200, { ok: true, context: await operations.setContext(body.text) })
              }
              if (action === 'setPersonaWeights') {
                return sendJson(res, 200, { ok: true, persona: await operations.setPersonaWeights(body.weights) })
              }
              sendJson(res, 400, { error: `unknown action "${String(action)}"` })
            } catch (error) {
              sendJson(res, 400, { error: String(error?.message ?? error) })
            }
          },
        }),
      ]
      return () => { for (const dispose of disposers) dispose() }
    }, 'subagent-types: routes')
  })
}