import test from 'node:test'
import assert from 'node:assert/strict'
import { decideChildPolicy, selectionFor } from '../lib/routing.js'

const explore = { id: 'explore', description: 'x', provider: 'magpie', model: 'flash', readonly: true }
const worker = { id: 'worker', description: 'x', provider: 'magpie', model: 'qwen4-max', readonly: false }
const types = { explore, worker }

function base(overrides = {}) {
  return {
    source: 'startup',
    origin: 'subagent',
    childOptions: { provider: 'magpie', model: 'qwen4-max', reasoningEffort: 'xhigh' },
    typeId: undefined,
    types,
    defaultType: 'worker',
    ...overrides,
  }
}

test('typed child applies its type policy without re-pinning the model', () => {
  const decision = decideChildPolicy(base({
    typeId: 'explore',
    childOptions: { provider: 'magpie', model: 'flash' },
  }))
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'typed')
  assert.equal(decision.pinModel, false)
  assert.equal(decision.type.id, 'explore')
})

test('typed marker wins even when the route equals the parent route', () => {
  const decision = decideChildPolicy(base({ typeId: 'worker' }))
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'typed')
})

test('unknown type marker falls through to the default rule', () => {
  const decision = decideChildPolicy(base({ typeId: 'ghost' }))
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'default')
  assert.equal(decision.type.id, 'worker')
})

test('untyped child falls back to the default type and pins the model', () => {
  const decision = decideChildPolicy(base())
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'default')
  assert.equal(decision.pinModel, true)
  assert.equal(decision.type.id, 'worker')
})

test('resume, compact, and clear keep recorded selections', () => {
  for (const source of ['resume', 'compact', 'clear']) {
    assert.deepEqual(decideChildPolicy(base({ source })), { action: 'skip', reason: 'not-fresh' })
  }
})

test('top-level sessions are never touched', () => {
  assert.deepEqual(decideChildPolicy(base({ origin: 'user' })), { action: 'skip', reason: 'not-subagent' })
})

test('explicit route override on an untyped child is ignored and pinned to the default type', () => {
  const decision = decideChildPolicy(base({
    childOptions: { provider: 'magpie-responses', model: 'auto/deepseek-v4.1-flash' },
  }))
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'default')
  assert.equal(decision.pinModel, true)
  assert.equal(decision.type.id, 'worker')
})

test('explicit selection equal to the parent route is still pinned to the default type', () => {
  const decision = decideChildPolicy(base({ childOptions: { provider: 'magpie', model: 'qwen4-max' } }))
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'default')
})

test('missing default type skips instead of guessing', () => {
  assert.deepEqual(
    decideChildPolicy(base({ types: { explore }, defaultType: 'worker' })),
    { action: 'skip', reason: 'no-default-type' },
  )
})

test('a workflow-style override to an arbitrary route is pinned to the default type', () => {
  const childOptions = { provider: 'other', model: 'some-model', reasoningEffort: 'high' }
  const decision = decideChildPolicy(base({ childOptions }))
  assert.equal(decision.action, 'apply')
  assert.equal(decision.basis, 'default')
  assert.equal(decision.type.id, 'worker')
  assert.deepEqual(selectionFor(decision.type, childOptions), { provider: 'magpie', model: 'qwen4-max' })
})

test('selectionFor keeps inherited effort on an unchanged route', () => {
  assert.deepEqual(selectionFor(worker, { provider: 'magpie', model: 'qwen4-max', reasoningEffort: 'xhigh' }), {
    provider: 'magpie', model: 'qwen4-max', reasoningEffort: 'xhigh',
  })
})

test('selectionFor drops inherited effort on a route change', () => {
  assert.deepEqual(selectionFor(explore, { provider: 'magpie', model: 'qwen4-max', reasoningEffort: 'xhigh' }), {
    provider: 'magpie', model: 'flash',
  })
})

test('selectionFor always prefers a type effort', () => {
  assert.deepEqual(selectionFor({ ...worker, reasoningEffort: 'high' }, { provider: 'magpie', model: 'qwen4-max', reasoningEffort: 'xhigh' }), {
    provider: 'magpie', model: 'qwen4-max', reasoningEffort: 'high',
  })
  assert.deepEqual(selectionFor({ ...explore, reasoningEffort: 'low' }, {}), {
    provider: 'magpie', model: 'flash', reasoningEffort: 'low',
  })
})