/**
 * Main-agent job context: the user's global job description for the main agent.
 * Pure module — no cordis, no IO. The Host storage, the same-origin routes, and
 * the tests all validate and render through these functions.
 *
 * Scope: one text per profile, injected into every main-agent assembly and
 * never into a delegated child (see `renderContextSection`). Only the text is
 * stored; the frame is added at render time so the panel can preview exactly
 * what the model will read.
 */

/**
 * Character ceiling for one stored job description. Counted in UTF-16 code
 * units — the same `length` the panel's counter shows.
 */
export const CONTEXT_MAX_LENGTH = 20000

/** Heading and lead-in prepended to the user's text. */
export const CONTEXT_FRAME = '## 主 agent 岗位说明（用户定义）\n以下内容是用户为你（主 agent）定义的岗位职责与工作偏好：\n'

/**
 * Canonical stored form: a string with edge whitespace trimmed and inner
 * newlines kept. Non-strings normalize to '' so a renderer never throws;
 * `contextProblems` is where bad input is reported.
 * @param {unknown} input
 * @returns {string}
 */
export function normalizeContextText(input) {
  return typeof input === 'string' ? input.trim() : ''
}

/**
 * Validate one submitted job description. An empty (or whitespace-only) text is
 * valid: it clears the section.
 * @param {unknown} text
 * @returns {string[]} human-readable problems; empty when valid.
 */
export function contextProblems(text) {
  if (typeof text !== 'string') return ['text must be a string']
  const length = normalizeContextText(text).length
  if (length > CONTEXT_MAX_LENGTH) {
    return [`text must be at most ${CONTEXT_MAX_LENGTH} characters (got ${length})`]
  }
  return []
}

/**
 * The system-prompt text for one assembly.
 *
 * The origin test is negative on purpose. The session header carries `origin`
 * only for children (`'subagent'`); a main-agent session has no origin field at
 * all, and a diagnostic assembly carries no agent either — so a positive test
 * (`origin === 'main'`) would drop the section exactly where it must appear.
 * @param {unknown} text - current stored text.
 * @param {string|undefined} origin - session header origin ('subagent' for children).
 * @returns {string} section text, or '' when it contributes nothing.
 */
export function renderContextSection(text, origin) {
  if (origin === 'subagent') return ''
  const normalized = normalizeContextText(text)
  if (normalized === '') return ''
  return `${CONTEXT_FRAME}${normalized}`
}
