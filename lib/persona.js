/**
 * User persona: who the main agent is writing for.
 *
 * The frame, the five preset identities, their three text bands, and the
 * ordering rule are a literal port of the retired `dsh-user-persona` plugin, so
 * folding the persona into this plugin cannot change a byte of what the model
 * reads (design doc §6.2). Pure module — no cordis, no IO, no storage: the Host
 * prompt section, the same-origin routes, and the tests all render through here.
 *
 * Shape of the injected text (see `renderPersona`): the highest weight leads
 * with its whole band, every other identity contributes one line each, and a
 * weight of 0 drops that identity entirely. The panel never renders persona
 * text itself — it shows the text this module produced, so there is exactly one
 * representation of the persona.
 */

/** Join lines, so each band stays readable in source. */
const lines = (...items) => items.join('\n')

/**
 * The frame every preset shares: who the reader is, why the split exists, and
 * what a good answer looks like to a human. This is not a format spec — the
 * output shape lives in the global rules; this is the judgment behind it.
 */
export const PERSONA_FRAME = lines(
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
export const PERSONA_PRESETS = [
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

const PRESET_BY_ID = new Map(PERSONA_PRESETS.map((preset) => [preset.id, preset]))

/**
 * Weight ceiling. Every stored or submitted weight is an integer in
 * 0–`PERSONA_MAX_WEIGHT`, and 0 means "do not inject this identity".
 */
export const PERSONA_MAX_WEIGHT = 100

/** Clamp any stored or submitted weight into 0–`PERSONA_MAX_WEIGHT`. */
export function normalizeWeight(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(PERSONA_MAX_WEIGHT, Math.round(numeric)))
}

/**
 * The bands a non-zero weight maps to — the single source of their thresholds.
 * `personaBand` reads this list and the Host sends it in the panel state, so the
 * "1–39 / 40–69 / 70–100" wording cannot drift from the injection. Bounds are
 * inclusive; 0 falls outside every band and injects nothing.
 */
export const PERSONA_BANDS = [
  { id: 'light', min: 1, max: 39 },
  { id: 'medium', min: 40, max: 69 },
  { id: 'full', min: 70, max: 100 },
]

/** Weight band name, the key into a preset's `bands`; 'off' injects nothing. */
export function personaBand(weight) {
  for (const band of PERSONA_BANDS) {
    if (weight >= band.min && weight <= band.max) return band.id
  }
  return 'off'
}

/** Read one preset's text for a weight; an off identity contributes nothing. */
function textOf(preset, weight) {
  const band = personaBand(weight)
  return band === 'off' ? '' : preset.bands[band]
}

/**
 * Render the section text. The highest weight leads and keeps its full band;
 * the rest contribute one line each, so two identities never fight over the
 * output shape.
 */
export function renderPersona(weights) {
  const rows = PERSONA_PRESETS
    .map((preset) => ({ preset, weight: normalizeWeight(weights?.[preset.id] ?? 0) }))
    .filter((row) => row.weight > 0)
    .sort((left, right) => right.weight - left.weight)
  if (rows.length === 0) return ''
  const [primary, ...rest] = rows
  const out = [
    '## 对话对象（用户画像）',
    PERSONA_FRAME,
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

/**
 * Canonical weights for one profile: exactly one integer entry per preset, so
 * storage, the state route, and the panel agree on the shape. Unknown ids are
 * dropped and values clamped — this is what also makes the retired plugin's
 * file readable. Non-objects carry no weights at all.
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function normalizePersonaWeights(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const weights = {}
  for (const preset of PERSONA_PRESETS) {
    weights[preset.id] = normalizeWeight(raw[preset.id] ?? 0)
  }
  return weights
}

/** A submitted value shown in a problem message without losing its type. */
function shown(value) {
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

/**
 * Validate one submitted weights map. Missing presets are fine (they mean 0);
 * every present entry must be an integer in 0–`PERSONA_MAX_WEIGHT` under a real
 * preset id. Problem wording follows `lib/context.js`: what is wrong, and the
 * value that was wrong.
 * @param {unknown} weights
 * @returns {string[]} human-readable problems; empty when valid.
 */
export function personaWeightProblems(weights) {
  if (weights === null || typeof weights !== 'object' || Array.isArray(weights)) {
    return ['weights must be an object keyed by preset id']
  }
  const problems = []
  for (const [id, value] of Object.entries(weights)) {
    if (!PRESET_BY_ID.has(id)) {
      problems.push(`unknown persona id "${id}"`)
      continue
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      problems.push(`persona "${id}" weight must be an integer (got ${shown(value)})`)
      continue
    }
    if (value < 0 || value > PERSONA_MAX_WEIGHT) {
      problems.push(`persona "${id}" weight must be between 0 and ${PERSONA_MAX_WEIGHT} (got ${value})`)
    }
  }
  return problems
}
