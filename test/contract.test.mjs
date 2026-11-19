import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TYPE_ID_RE, RESERVED_TOOL_NAMES,
  typeProblems, normalizeType, routeOf, sameRoute,
} from '../lib/contract.js'

const valid = {
  id: 'explore',
  description: 'Read-only investigation.',
  provider: 'magpie',
  model: 'opencode-go/deepseek-v4.1-flash',
  readonly: true,
}

test('id pattern accepts lowercase names and rejects the rest', () => {
  for (const good of ['explore', 'worker', 'reviewer-2', 'a', 'a-b-c-123']) {
    assert.equal(TYPE_ID_RE.test(good), true, good)
  }
  for (const bad of ['Explore', '1abc', '-abc', 'abc_def', 'abc.def', '', 'a'.repeat(33), 'abc def']) {
    assert.equal(TYPE_ID_RE.test(bad), false, bad)
  }
})

test('a valid type has no problems', () => {
  assert.deepEqual(typeProblems(valid), [])
  assert.deepEqual(typeProblems({ ...valid, readonly: false, reasoningEffort: 'low' }), [])
})

test('validation names each broken field', () => {
  const problems = typeProblems({ id: 'X', description: '', provider: '', model: '', readonly: 'yes' })
  assert.equal(problems.length, 5)
  assert.match(problems.join('\n'), /id must match/)
  assert.match(problems.join('\n'), /description/)
  assert.match(problems.join('\n'), /provider/)
  assert.match(problems.join('\n'), /model/)
  assert.match(problems.join('\n'), /readonly must be a boolean/)
})

test('readonly is required; empty or non-string effort is a problem', () => {
  const { readonly, ...noReadonly } = valid
  assert.equal(typeProblems(noReadonly).length, 1)
  assert.equal(typeProblems({ ...valid, reasoningEffort: '' }).length, 1)
  assert.equal(typeProblems({ ...valid, reasoningEffort: 3 }).length, 1)
})

test('normalize trims strings and keeps absent effort absent', () => {
  const normalized = normalizeType({ ...valid, description: '  hi  ', provider: ' magpie ' })
  assert.equal(normalized.description, 'hi')
  assert.equal(normalized.provider, 'magpie')
  assert.equal(normalized.readonly, true)
  assert.equal(Object.hasOwn(normalized, 'reasoningEffort'), false)
  assert.equal(normalizeType({ ...valid, reasoningEffort: ' low ' }).reasoningEffort, 'low')
})

test('routeOf carries effort only when present; sameRoute ignores effort', () => {
  assert.deepEqual(routeOf(valid), { provider: 'magpie', model: 'opencode-go/deepseek-v4.1-flash' })
  assert.deepEqual(routeOf({ ...valid, reasoningEffort: 'low' }), {
    provider: 'magpie', model: 'opencode-go/deepseek-v4.1-flash', reasoningEffort: 'low',
  })
  assert.equal(sameRoute({ provider: 'a', model: 'b' }, { provider: 'a', model: 'b', reasoningEffort: 'x' }), true)
  assert.equal(sameRoute({ provider: 'a', model: 'b' }, { provider: 'a', model: 'c' }), false)
  assert.equal(sameRoute(undefined, { provider: 'a', model: 'b' }), false)
})

test('shipped delegation and control names are reserved', () => {
  for (const name of ['subagent', 'subagent_fork', 'delegate_sync', 'list_subagent_models', 'send_message']) {
    assert.equal(RESERVED_TOOL_NAMES.has(name), true, name)
  }
  assert.equal(RESERVED_TOOL_NAMES.has('explore'), false)
})