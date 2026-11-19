import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PERSONA_BANDS, PERSONA_FRAME, PERSONA_MAX_WEIGHT, PERSONA_PRESETS,
  normalizePersonaWeights, normalizeWeight, personaBand, personaWeightProblems,
  renderPersona as portRender,
} from '../lib/persona.js'

/**
 * Byte-identity tests for the persona port (design doc §6.2).
 *
 * The oracle below is a verbatim copy of the retired dsh-user-persona renderer,
 * not this plugin's own code: if the frame, a band text, the ordering rule, or
 * the join punctuation drifts, these assertions fail on the exact string. The
 * copy outlives the source plugin, so the proof survives the retirement.
 */

/* ==========================================================================
 * The retired user-persona plugin's renderer, copied verbatim
 * (dsh-plugin/dsh-user-persona/host.js:25-211, transcribed 2026-11-18).
 * Deliberately under its original names — do not tidy it.
 * ========================================================================== */

/** Join lines, so each band stays readable in source. */
const lines = (...items) => items.join('\n')

/**
 * The frame every preset shares: who the reader is, why the split exists, and
 * what a good answer looks like to a human. This is not a format spec — the
 * output shape lives in the global rules; this is the judgment behind it.
 */
const FRAME = lines(
  '只有你们两个人：没有第三方，也没有别人需要转达。',
  '分工是：信息由你吃下，判断由他做出。你一次能读完整个代码库，他读不完；但他看一眼就知道这条路值不值得走——那取决于他想要什么，而你想要不出来。',
  '所以他站在「用户与产品」这一侧：值不值得做、做出来什么感觉、范围划到哪；你站在「实现与系统」这一侧：怎么改、代价在哪、哪里会崩。',
  '用细节淹没他，等于废掉他唯一比你强的地方；替他拍板，等于拿你的推测顶替他的意图。',
  '',
  '什么叫好的返回：',
  '- 判据只有一条：他读完能直接做决定，或者直接把这句话说给别人听。',
  '- 好：结论和影响在前，要他选的路在后（2–3 条，各自的代价），他一眼看出要不要做、选哪条。',
  '- 坏：事实铺满让他自己总结；只给一条没有退路的最优解；用「已经改好了」代替他能自己验证的东西。',
  '- 坏答案通常不是信息太少，而是信息多到要他把你的活再干一遍。',
  '',
  '代价口径：不用天/周/人日，按「本轮能否收口、要几个切片、每个切片交付什么、他要做什么验收」说；不要用工期估算替他缩小范围，只有他明确要对外报价时才换算工期。',
)

/**
 * Preset identities. A band is chosen by weight: `light` (1–39), `medium`
 * (40–69), `full` (70–100). Bands describe the reader, not the output
 * template — the template already lives in the global rules.
 */
const PRESETS = [
  {
    id: 'pm',
    label: '产品经理',
    tagline: '不写代码，拿你的回复去对齐决策',
    bands: {
      light: lines(
        '他不写代码，替用户和产品说话；细节由你定。',
      ),
      medium: lines(
        '他替用户和产品说话，不替实现说话——这是立场，不是职位。',
        '他不写代码，判断只落在四件事上：用户体验、交付成本（本轮/切片）、维护成本、上线风险。',
        '细节上下文他跟不上，细节由你定，不要拿细节请他决策。',
      ),
      full: lines(
        '他替用户和产品说话，不替实现说话——这是立场，不是职位。',
        '- 他不写代码，判断只落在四件事上：用户体验、交付成本（本轮/切片）、维护成本、上线风险。',
        '- 他不追细节上下文；细节由你定，别拿细节请他决策。',
        '- 回复的形态（结论先行、影响居中、动作收尾）按通用规则走，这里不重复。',
      ),
    },
  },
  {
    id: 'design',
    label: '设计与体验',
    tagline: '关心用户看到什么、感觉到什么',
    bands: {
      light: lines(
        '他站在「用户看到什么、感觉到什么」这一侧。',
      ),
      medium: lines(
        '他站在「用户看到什么、感觉到什么」这一侧，判断标准是「看起来对不对、用起来顺不顺」。',
        '版式、动效、一致性、深色模式和窄屏都是他会追问的地方——改动前先说清会影响哪几处。',
        '涉及好看不好看，给方案对比并说清代价，不要替他拍板。',
      ),
      full: lines(
        '他站在「用户看到什么、感觉到什么」这一侧，判断标准是「看起来对不对、用起来顺不顺」。',
        '- 先说用户看到什么、感觉到什么，再说技术怎么实现。',
        '- 版式、动效、一致性、深色模式、窄屏都是他的关注面，改动前先说明影响哪几处。',
        '- 好不好看由他判断：你只做事实检查（有没有遮挡、裁切、溢出、错位），不替他宣告通过。',
      ),
    },
  },
  {
    id: 'dev',
    label: '开发与技术',
    tagline: '要细节、要能直接落地的方案',
    bands: {
      light: lines(
        '和你对话的人是开发者，可以直接讲实现，给关键代码位置和取舍。',
      ),
      medium: lines(
        '和你对话的人是开发者，能读代码。先一句结论，再给实现路径、影响面和验证方式。',
        '代码片段只贴关键几行，并说明为什么这样改。',
      ),
      full: lines(
        '他是开发者，能读代码，要的是能直接执行的方案。',
        '- 先一句结论，再给：改哪里、为什么改、影响面、怎么验证。',
        '- 代码片段只贴关键几行并标注文件与位置；不要整段粘贴已知内容。',
        '- 明确说出风险和回退方式；拿不准的地方标「未核实」，不要含糊。',
        '- 他要技术细节时不必翻译成业务语言，但仍先给结论再给细节。',
      ),
    },
  },
  {
    id: 'biz',
    label: '业务与创始人',
    tagline: '只关心成本、轮次、风险和收益',
    bands: {
      light: lines(
        '和你对话的人是业务负责人，只关心成本、轮次、风险和收益，不要讲实现。',
      ),
      medium: lines(
        '和你对话的人是业务负责人，只关心成本、轮次、风险和收益。',
        '每个判断附上「不做会怎样」，能用数字就用数字；不要讲技术实现。',
      ),
      full: lines(
        '他是业务负责人，只关心成本、轮次、风险和收益，不看技术实现。',
        '- 开头一句话说清：这件事对他意味着什么、需要他投入什么。',
        '- 每个判断附上「不做会怎样」；能用轮次、切片数、金额就用数字，不用天数。',
        '- 不要出现任何技术名词；必须提的时候用「街上的人也能听懂」的说法。',
        '- 给他 2–3 个选项和各自的代价，不要给一个没有退路的方案。',
      ),
    },
  },
  {
    id: 'learner',
    label: '学习者',
    tagline: '在学，需要类比和分步骤',
    bands: {
      light: lines(
        '和你对话的人正在学习，解释概念时先给类比，再给定义。',
      ),
      medium: lines(
        '和你对话的人正在学习，需要理解而不只是结果。',
        '先给类比再给定义，分步骤讲，每一步说清「为什么」；不要跳步。',
      ),
      full: lines(
        '他正在学习这门技术，要的是理解，不是直接能跑的答案。',
        '- 先给一个生活中的类比，再给准确说法，最后给一个最小可运行的例子。',
        '- 分步骤，每步说明为什么这么做；不要跳过中间推理。',
        '- 遇到名词先解释再用；解释里再出现新名词就继续展开，直到落到他已知的概念。',
        '- 结尾给一个自测问题，让他确认自己真的懂了。',
      ),
    },
  },
]

const PRESET_BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]))
/** Default: the exact reader this harness was tuned for. */
const DEFAULT_WEIGHTS = { pm: 80 }

/** Clamp any stored or submitted weight into 0–100. */
function clampWeight(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

/** Weight band name, the key into a preset's `bands`. */
function bandOf(weight) {
  if (weight >= 70) return 'full'
  if (weight >= 40) return 'medium'
  if (weight >= 1) return 'light'
  return 'off'
}

/** Read one preset's text for a weight; an off identity contributes nothing. */
function textOf(preset, weight) {
  const band = bandOf(weight)
  return band === 'off' ? '' : preset.bands[band]
}

/**
 * Render the section text. The highest weight leads and keeps its full band;
 * the rest contribute one line each, so two identities never fight over the
 * output shape.
 */
function renderPersona(weights) {
  const rows = PRESETS
    .map((preset) => ({ preset, weight: clampWeight(weights?.[preset.id] ?? 0) }))
    .filter((row) => row.weight > 0)
    .sort((left, right) => right.weight - left.weight)
  if (rows.length === 0) return ''
  const [primary, ...rest] = rows
  const out = [
    '## 对话对象（用户画像）',
    FRAME,
    '',
    `他这次的重心：${primary.preset.label}（权重 ${primary.weight}%）`,
    textOf(primary.preset, primary.weight),
  ]
  for (const row of rest) {
    const text = textOf(row.preset, row.weight)
    if (text === '') continue
    out.push('', `同时兼顾：${row.preset.label}（权重 ${row.weight}%）——`, text)
  }
  return out.join('\n')
}

/* ========================================================================== */

/** The expected shape of a two-identity render, pinned as literals. */
function twoIdentityRender(lead, second) {
  return [
    '## 对话对象（用户画像）',
    FRAME,
    '',
    lead,
    PRESETS[0].bands.full,
    '',
    `${second}——`,
    PRESETS[1].bands.medium,
  ].join('\n')
}

/** Every weight combination worth pinning: live values, clearing, ties, edges. */
function cases() {
  const list = [
    { label: 'live profile values', weights: { pm: 80, design: 40 } },
    { label: 'all five zero', weights: { pm: 0, design: 0, dev: 0, biz: 0, learner: 0 } },
    { label: 'empty object clears everything', weights: {} },
    { label: 'missing map (undefined)', weights: undefined },
    { label: 'null map', weights: null },
    { label: 'a non-object map', weights: 42 },
    { label: 'one identity only', weights: { design: 40 } },
    { label: 'the heaviest identity carries its whole band', weights: { learner: 100 } },
    { label: 'two identities tied', weights: { pm: 50, design: 50 } },
    { label: 'three identities tied', weights: { pm: 60, dev: 60, biz: 60 } },
    { label: 'all five, distinct weights', weights: { learner: 100, biz: 80, dev: 60, design: 40, pm: 20 } },
    { label: 'unknown ids alone contribute nothing', weights: { foo: 50, bar: 80 } },
    { label: 'unknown ids are ignored beside real ones', weights: { foo: 50, pm: 80 } },
    { label: 'numeric strings still count', weights: { pm: '80', design: '40' } },
    { label: 'fractions round', weights: { pm: 80.6, design: 39.4 } },
    { label: 'out-of-range values clamp', weights: { pm: 150, design: -20 } },
  ]
  for (const preset of ['pm', 'design', 'dev', 'biz', 'learner']) {
    for (const weight of [1, 39, 40, 69, 70, 100]) {
      list.push({ label: `${preset} at the ${weight} band edge`, weights: { [preset]: weight } })
    }
  }
  return list
}

test('PERSONA_FRAME is the retired plugin frame byte for byte', () => {
  assert.equal(PERSONA_FRAME, FRAME)
})

test('the preset roster is unchanged: ids, labels, taglines, every band text', () => {
  assert.deepEqual(PERSONA_PRESETS, PRESETS)
  assert.equal(PERSONA_PRESETS.length, 5)
  assert.deepEqual(PERSONA_PRESETS.map((preset) => preset.id), ['pm', 'design', 'dev', 'biz', 'learner'])
})

test('renderPersona matches the retired plugin byte for byte', () => {
  for (const { label, weights } of cases()) {
    assert.equal(portRender(weights), renderPersona(weights), label)
  }
})

test('renderPersona leads with the heaviest identity and appends the rest one by one', () => {
  const out = portRender({ pm: 80, design: 40 })
  assert.equal(out, twoIdentityRender('他这次的重心：产品经理（权重 80%）', '同时兼顾：设计与体验（权重 40%）'))
  assert.equal(out.startsWith('## 对话对象（用户画像）\n'), true)
  assert.equal(out.includes('版式、动效、一致性、深色模式和窄屏都是他会追问的地方'), true)
})

test('renderPersona injects nothing when every weight is zero, absent, or unknown', () => {
  assert.equal(portRender(normalizePersonaWeights({})), '')
  assert.equal(portRender({}), '')
  assert.equal(portRender(undefined), '')
  // The retired plugin fell back to { pm: 80 } when its file was unreadable;
  // this plugin's contract starts empty (design doc §6.1), so no such default.
  assert.equal(portRender({ foo: 80 }), '')
})

test('personaBand agrees with the retired plugin for every weight 0-100', () => {
  for (let weight = 0; weight <= PERSONA_MAX_WEIGHT; weight += 1) {
    assert.equal(personaBand(weight), bandOf(weight), `weight ${weight}`)
  }
})

test('the band table carries the documented thresholds', () => {
  assert.equal(PERSONA_MAX_WEIGHT, 100)
  assert.deepEqual(PERSONA_BANDS, [
    { id: 'light', min: 1, max: 39 },
    { id: 'medium', min: 40, max: 69 },
    { id: 'full', min: 70, max: 100 },
  ])
})

test('normalizeWeight clamps and rounds exactly like the retired plugin', () => {
  for (const value of [0, 1, 39, 39.4, 40, 69, 70, 80.6, 100, 150, -20, '80', 'x', null, undefined, NaN, Infinity]) {
    assert.equal(normalizeWeight(value), clampWeight(value), String(value))
  }
})

test('normalizePersonaWeights returns one integer per preset and drops strangers', () => {
  const canonical = normalizePersonaWeights({ pm: 80, design: 40, foo: 90, biz: 150 })
  assert.deepEqual(canonical, { pm: 80, design: 40, dev: 0, biz: 100, learner: 0 })
  assert.deepEqual(Object.keys(canonical), ['pm', 'design', 'dev', 'biz', 'learner'])
})

test('normalizePersonaWeights refuses non-objects', () => {
  for (const value of [undefined, null, 42, 'pm', true, [], () => {}]) {
    assert.deepEqual(normalizePersonaWeights(value), {})
  }
})

test('personaWeightProblems accepts integers in range, including a partial or empty map', () => {
  assert.deepEqual(personaWeightProblems({ pm: 80, design: 40 }), [])
  assert.deepEqual(personaWeightProblems({ learner: 0 }), [])
  assert.deepEqual(personaWeightProblems({}), [])
  assert.deepEqual(personaWeightProblems({ pm: 100, design: 1, dev: 39, biz: 40, learner: 69 }), [])
})

test('personaWeightProblems rejects non-objects', () => {
  for (const value of [undefined, null, 42, 'pm', true, []]) {
    assert.deepEqual(personaWeightProblems(value), ['weights must be an object keyed by preset id'])
  }
})

test('personaWeightProblems rejects unknown preset ids', () => {
  assert.deepEqual(personaWeightProblems({ foo: 80 }), ['unknown persona id "foo"'])
  assert.deepEqual(personaWeightProblems({ pm: 80, manager: 20 }), ['unknown persona id "manager"'])
})

test('personaWeightProblems rejects non-integer weights and names the value', () => {
  assert.deepEqual(personaWeightProblems({ pm: 80.5 }), ['persona "pm" weight must be an integer (got 80.5)'])
  assert.deepEqual(personaWeightProblems({ pm: '80' }), ['persona "pm" weight must be an integer (got "80")'])
  assert.deepEqual(personaWeightProblems({ design: null }), ['persona "design" weight must be an integer (got null)'])
  assert.deepEqual(personaWeightProblems({ dev: NaN }), ['persona "dev" weight must be an integer (got NaN)'])
})

test('personaWeightProblems rejects weights outside 0-100', () => {
  assert.deepEqual(personaWeightProblems({ pm: 101 }), ['persona "pm" weight must be between 0 and 100 (got 101)'])
  assert.deepEqual(personaWeightProblems({ pm: -1 }), ['persona "pm" weight must be between 0 and 100 (got -1)'])
})

test('personaWeightProblems reports every problem it finds', () => {
  assert.deepEqual(
    personaWeightProblems({ manager: 10, pm: 101, design: 4.5 }),
    [
      'unknown persona id "manager"',
      'persona "pm" weight must be between 0 and 100 (got 101)',
      'persona "design" weight must be an integer (got 4.5)',
    ],
  )
})
