import test from 'node:test'
import assert from 'node:assert/strict'
import { READONLY_DENIED_TOOLS, guardFor, personaText } from '../lib/policy.js'

const explore = {
  id: 'explore', description: 'Read-only investigation.',
  provider: 'magpie', model: 'flash', readonly: true,
}
const worker = {
  id: 'worker', description: 'Implementation work.',
  provider: 'magpie', model: 'qwen4-max', readonly: false,
}

test('read-only guard denies every mutation tool with a type-named reason', () => {
  const guard = guardFor(explore)
  for (const name of READONLY_DENIED_TOOLS) {
    const denial = guard({ name })
    assert.equal(typeof denial, 'string', name)
    assert.match(denial, /explore/)
    assert.match(denial, /read-only/)
  }
})

test('read-only guard allows read and search tools', () => {
  const guard = guardFor(explore)
  for (const name of ['read', 'read_image', 'glob', 'grep', 'web_fetch', 'list_subagent_types']) {
    assert.equal(guard({ name }), undefined, name)
  }
})

test('writable types get no guard', () => {
  assert.equal(guardFor(worker), undefined)
})

test('persona seeds the type description and the enforcement semantics', () => {
  assert.match(personaText(explore), /Read-only investigation\./)
  assert.match(personaText(explore), /denied at execution time/)
  assert.match(personaText(worker), /Implementation work\./)
  assert.match(personaText(worker), /verify your own work/)
})