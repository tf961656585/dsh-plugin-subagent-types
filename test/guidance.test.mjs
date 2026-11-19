import test from 'node:test'
import assert from 'node:assert/strict'
import { guidanceText, routeLabel } from '../lib/guidance.js'

const explore = {
  id: 'explore', description: 'Read-only investigation.',
  provider: 'magpie', model: 'flash', reasoningEffort: 'max', readonly: true,
}
const worker = {
  id: 'worker', description: 'Implementation work.',
  provider: 'magpie', model: 'qwen4-max', readonly: false,
}
const roster = [explore, worker]

test('routeLabel renders the effort only when present', () => {
  assert.equal(routeLabel(explore), 'magpie/flash (effort: max)')
  assert.equal(routeLabel(worker), 'magpie/qwen4-max')
})

test('an empty roster contributes nothing for every origin', () => {
  for (const origin of [undefined, 'subagent', 'cli']) {
    assert.equal(guidanceText([], 'worker', origin), '')
  }
})

test('the main-agent text lists every type with its route and flags', () => {
  const out = guidanceText(roster, 'worker', undefined)
  assert.equal(out.startsWith('## Subagent types\n'), true)
  assert.equal(out.includes('- `explore` — magpie/flash (effort: max), read-only (mutation tools denied). Read-only investigation.'), true)
  assert.equal(out.includes('- `worker` — magpie/qwen4-max. Implementation work.'), true)
  assert.equal(out.includes('also start children on the default type\'s model (`worker`)'), true)
})

test('the main-agent text keeps the management sentence', () => {
  const out = guidanceText(roster, 'worker', undefined)
  assert.equal(out.includes('Manage types with `list_subagent_types`, `create_subagent_type`, `update_subagent_type`, `delete_subagent_type` (top-level sessions only)'), true)
  // The management surface moved from the Plugins settings card to the sidebar panel.
  assert.equal(out.includes('or in the Agent Organization panel in the left sidebar'), true)
  assert.equal(out.includes('configuration page'), false)
})

test('a child gets the roster and delegation rules without the management sentence', () => {
  const main = guidanceText(roster, 'worker', undefined).split('\n')
  const child = guidanceText(roster, 'worker', 'subagent').split('\n')
  assert.deepEqual(main.filter(line => !line.startsWith('Manage types with')), child)
  assert.equal(main.length, child.length + 1)
  assert.equal(child.some(line => line.startsWith('Manage types with')), false)
  assert.equal(child.includes('- `worker` — magpie/qwen4-max. Implementation work.'), true)
})

test('an absent agent keeps the main-agent text verbatim', () => {
  assert.equal(guidanceText(roster, 'worker', undefined), guidanceText(roster, 'worker', null))
  // Any other origin value is not a delegated child, so the full text stays.
  assert.equal(guidanceText(roster, 'worker', 'cli'), guidanceText(roster, 'worker', undefined))
})
