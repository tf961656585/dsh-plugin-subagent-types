import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTEXT_FRAME, CONTEXT_MAX_LENGTH, contextProblems, normalizeContextText, renderContextSection,
} from '../lib/context.js'

const FRAME_LITERAL = '## 主 agent 岗位说明（用户定义）\n以下内容是用户为你（主 agent）定义的岗位职责与工作偏好：\n'

test('CONTEXT_MAX_LENGTH is the contract ceiling', () => {
  assert.equal(CONTEXT_MAX_LENGTH, 20000)
})

test('CONTEXT_FRAME is the fixed heading and lead-in', () => {
  assert.equal(CONTEXT_FRAME, FRAME_LITERAL)
})

test('normalizeContextText trims edges and keeps inner newlines', () => {
  assert.equal(normalizeContextText('  先给结论\n\n再给选项  \n'), '先给结论\n\n再给选项')
  assert.equal(normalizeContextText('\t单行\r\n'), '单行')
})

test('normalizeContextText returns empty for non-strings', () => {
  for (const value of [undefined, null, 42, true, {}, [], () => {}]) {
    assert.equal(normalizeContextText(value), '')
  }
})

test('contextProblems accepts a string within the limit, including empty', () => {
  assert.deepEqual(contextProblems('先给结论再给选项'), [])
  assert.deepEqual(contextProblems(''), [])
  assert.deepEqual(contextProblems('   \n  '), [])
  assert.deepEqual(contextProblems('a'.repeat(CONTEXT_MAX_LENGTH)), [])
})

test('contextProblems rejects non-strings', () => {
  for (const value of [undefined, null, 42, {}, []]) {
    assert.deepEqual(contextProblems(value), ['text must be a string'])
  }
})

test('contextProblems rejects text over the limit and names the limit and the length', () => {
  const over = 'a'.repeat(CONTEXT_MAX_LENGTH + 1)
  assert.deepEqual(contextProblems(over), [`text must be at most 20000 characters (got ${CONTEXT_MAX_LENGTH + 1})`])
})

test('contextProblems measures the trimmed text, so edge whitespace does not count', () => {
  const padded = `  ${'a'.repeat(CONTEXT_MAX_LENGTH)}\n\n`
  assert.deepEqual(contextProblems(padded), [])
})

test('renderContextSection excludes delegated children only', () => {
  assert.equal(renderContextSection('先给结论', 'subagent'), '')
  // Any other origin value is a main-agent assembly, so it injects.
  assert.equal(renderContextSection('先给结论', 'subagent '), `${FRAME_LITERAL}先给结论`)
})

test('renderContextSection injects when the agent is absent (diagnostic assembly)', () => {
  assert.equal(renderContextSection('先给结论', undefined), `${FRAME_LITERAL}先给结论`)
  assert.equal(renderContextSection('先给结论', null), `${FRAME_LITERAL}先给结论`)
})

test('renderContextSection injects for every non-subagent origin', () => {
  for (const origin of ['cli', 'web', 'startup', 'resume', '']) {
    assert.equal(renderContextSection('先给结论', origin), `${FRAME_LITERAL}先给结论`)
  }
})

test('renderContextSection contributes nothing for empty or whitespace-only text', () => {
  assert.equal(renderContextSection('', undefined), '')
  assert.equal(renderContextSection('   \n\t', undefined), '')
  assert.equal(renderContextSection(undefined, undefined), '')
})

test('renderContextSection renders the frame once and keeps internal newlines', () => {
  const out = renderContextSection('  第一条\n第二条  ', 'cli')
  assert.equal(out, `${FRAME_LITERAL}第一条\n第二条`)
  assert.equal(out.startsWith(FRAME_LITERAL), true)
  assert.equal(out.indexOf('## 主 agent 岗位说明'), out.lastIndexOf('## 主 agent 岗位说明'))
})
