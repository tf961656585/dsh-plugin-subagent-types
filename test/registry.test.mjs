import test from 'node:test'
import assert from 'node:assert/strict'
import { TypeRegistry } from '../lib/registry.js'

function fakeTable() {
  const records = new Map()
  return {
    get: key => records.get(key),
    entries: () => records.entries(),
    put: async (key, value) => { records.set(key, value) },
    delete: async key => records.delete(key),
  }
}

const exploreSeed = {
  id: 'explore', description: 'Read-only investigation.',
  provider: 'magpie', model: 'flash', readonly: true,
}
const workerSeed = {
  id: 'worker', description: 'Implementation work.',
  provider: 'magpie', model: 'qwen4-max', readonly: false,
}

function registry(table = fakeTable(), overrides = {}) {
  return new TypeRegistry(table, { defaultType: 'worker', seeds: [exploreSeed, workerSeed], ...overrides })
}

test('init seeds missing types and validates the default', async () => {
  const table = fakeTable()
  const reg = registry(table)
  await reg.init()
  assert.deepEqual(reg.list().map(t => t.id), ['explore', 'worker'])
  assert.equal(reg.get('explore').model, 'flash')
})

test('init never overwrites stored edits', async () => {
  const table = fakeTable()
  await table.put('explore', { ...exploreSeed, model: 'edited-model' })
  await registry(table).init()
  assert.equal(table.get('explore').model, 'edited-model')
})

test('init fails loud when the default type is absent', async () => {
  const reg = registry(fakeTable(), { seeds: [exploreSeed] })
  await assert.rejects(() => reg.init(), /default type "worker" does not exist/)
})

test('init rejects an invalid seed', async () => {
  const reg = registry(fakeTable(), { seeds: [{ ...exploreSeed, id: 'Bad' }] })
  await assert.rejects(() => reg.init(), /seed type "Bad" invalid/)
})

test('create validates, rejects duplicates, and normalizes', async () => {
  const reg = registry()
  await reg.init()
  const created = await reg.create({
    id: 'reviewer', description: '  Reviews changes.  ',
    provider: 'magpie', model: 'flash', readonly: true,
  })
  assert.equal(created.description, 'Reviews changes.')
  assert.equal(reg.get('reviewer').id, 'reviewer')
  await assert.rejects(() => reg.create({ ...exploreSeed }), /already exists/)
  await assert.rejects(() => reg.create({ ...exploreSeed, id: 'x', readonly: 'wild' }), /readonly/)
})

test('update requires provider and model together for a route change', async () => {
  const reg = registry()
  await reg.init()
  await assert.rejects(() => reg.update('explore', { provider: 'other' }), /together/)
  await assert.rejects(() => reg.update('explore', { model: 'other' }), /together/)
  const updated = await reg.update('explore', { provider: 'magpie-responses', model: 'auto/flash' })
  assert.equal(updated.provider, 'magpie-responses')
  assert.equal(updated.model, 'auto/flash')
})

test('update clears effort on empty and keeps other fields', async () => {
  const reg = registry()
  await reg.init()
  await reg.update('worker', { reasoningEffort: 'high' })
  assert.equal(reg.get('worker').reasoningEffort, 'high')
  const cleared = await reg.update('worker', { reasoningEffort: '' })
  assert.equal(Object.hasOwn(cleared, 'reasoningEffort'), false)
  assert.equal(cleared.model, 'qwen4-max')
})

test('update clears effort on null (page route convention)', async () => {
  const reg = registry()
  await reg.init()
  await reg.update('worker', { reasoningEffort: 'high' })
  const cleared = await reg.update('worker', { reasoningEffort: null })
  assert.equal(Object.hasOwn(cleared, 'reasoningEffort'), false)
})

test('update can change the read-only flag and description', async () => {
  const reg = registry()
  await reg.init()
  const updated = await reg.update('explore', { readonly: false, description: 'Now writable.' })
  assert.equal(updated.readonly, false)
  assert.equal(updated.description, 'Now writable.')
})

test('update rejects unknown types and invalid results', async () => {
  const reg = registry()
  await reg.init()
  await assert.rejects(() => reg.update('ghost', { description: 'x' }), /does not exist/)
  await assert.rejects(() => reg.update('explore', { description: '   ' }), /description/)
})

test('remove deletes non-default types and protects the default', async () => {
  const reg = registry()
  await reg.init()
  await reg.remove('explore')
  assert.equal(reg.get('explore'), undefined)
  await assert.rejects(() => reg.remove('worker'), /default type/)
  await assert.rejects(() => reg.remove('explore'), /does not exist/)
})

test('map projects the plain id-to-type object routing reads', async () => {
  const reg = registry()
  await reg.init()
  const map = reg.map()
  assert.deepEqual(Object.keys(map), ['explore', 'worker'])
  assert.equal(map.explore.readonly, true)
})