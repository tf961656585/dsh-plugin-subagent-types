/**
 * Agent organization — Client half.
 *
 * A left-sidebar panel (`sidebar.panellist` tab + `main` panel, both keyed by
 * PANEL_ID) in two blocks: the main agent (block A) and the subagent type
 * registry (block B). Block A carries the job description and the user-persona
 * weight sliders. The former Plugins-page configuration card, and the separate
 * user-persona plugin, are both retired — this panel is the only surface.
 *
 * Both blocks read one Host state route and write through the same-origin
 * mutate route; the Host validates every write against the live LLM providers.
 * The character ceiling, the injection frame, the persona presets, their band
 * thresholds, and both preview texts all come from the Host state — the client
 * hardcodes none of them, so a preview cannot drift from the real injection.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-subagent-types',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'subagent-types'
    const PANEL_ID = 'agent-organization'
    const ROUTE_STATE = '/plugin/subagent-types/state'
    const ROUTE_VERIFY = '/plugin/subagent-types/verify'
    const ROUTE_MODELS = '/plugin/subagent-types/models'
    const ROUTE_MUTATE = '/plugin/subagent-types/mutate'
    const ID_RE = /^[a-z][a-z0-9-]{0,31}$/

    const zh = {
      panel: 'agent 组织',
      panelFailed: 'agent 组织面板这块没能显示出来。刷新页面多半能恢复；如果还不行，展开开发者工具看控制台里的报错。',
      loading: '正在读取…',
      loadFailed: '面板内容没读出来，检查一下连接再试。',
      retry: '重试',
      actionFailed: '操作没成功：',

      blockMain: '主 agent',
      contextLabel: '岗位说明',
      contextHint: '写入主 agent 的系统提示，保存后下一次回复生效；子代理不受影响',
      contextPlaceholder: '例如：回复先给结论再给选项；涉及界面改动先出原型；不确定时先问我。',
      charCount: '{n} / {max}',
      overLimit: '{n} / {max}（超出上限，请先删减）',
      dirty: '未保存',
      save: '保存',
      saving: '保存中…',
      saved: '已保存，下一次回复起生效',
      previewTitle: '注入预览',
      previewSavedTag: '已保存内容',
      previewDraftTag: '草稿（未保存）',
      previewEmpty: '（空文本：保存后这一段不会注入）',
      previewNote: '编辑时预览跟随草稿；保存后与真实注入一致。',
      verify: '验证注入',
      verifying: '验证中…',
      verifyOk: '注入正常',
      verifyFail: '未注入',
      verifyEmpty: '未填写岗位说明',

      personaTitle: '画像权重',
      personaHint: '0 表示不注入该身份；权重越高，注入的画像描述越具体；拖动后自动保存，下一次回复生效。',
      personaPreviewTitle: '画像注入预览（实时）',
      personaValue: '{weight} · {band}',
      personaEmpty: '（所有身份权重为 0：不注入画像段）',
      bandNone: '不注入',
      bandLight: '简版（1–39）',
      bandMedium: '中档（40–69）',
      bandFull: '完整（70–100）',
      weightAria: '{label} 权重',

      blockTeam: '子代理团队',
      defaultType: '默认类型',
      defaultTypeHint: '没有走类型入口的委派（原委派工具、同步委派、上下文分叉、工作流）统一落这个类型的型号。',
      newType: '新建类型',
      editTypeTitle: '编辑类型 · {id}',
      edit: '编辑',
      remove: '删除',
      confirmDeleteBtn: '确认删除',
      cancel: '取消',
      typeEmpty: '还没有类型。新建一个，或让 agent 用管理工具创建。',
      idLabel: '类型 id（即委派入口名）',
      idHint: '小写字母开头，可含小写字母、数字、连字符，最长 32 位；不能与现有工具重名。',
      idPlaceholder: 'reviewer',
      descriptionLabel: '用途说明',
      descriptionHint: '告诉主 agent 什么时候用这个类型，也会写进子代理的角色提示。',
      providerLabel: '模型线路',
      pickProvider: '先选线路',
      modelLabel: '型号',
      pickModel: '选型号',
      modelLoading: '正在读取型号…',
      effortLabel: '推理力度',
      effortDefault: '跟模型默认',
      readonlyLabel: '只读（拒绝 bash / write / edit / apply_patch）',
      readonlyTag: '只读',
      writableTag: '可写',
      defaultTag: '默认',
      defaultDeleteHint: '默认类型不能删除；要删它，先把默认类型换成别的。',
      idInvalid: 'id 格式不对',
      descriptionRequired: '用途说明不能为空',
      routeRequired: '线路和型号都要选',
    }
    const en = {
      panel: 'Agent Organization',
      panelFailed: 'This part of the Agent Organization panel could not render. A refresh usually restores it; if not, check the console for the error.',
      loading: 'Loading…',
      loadFailed: 'Could not load the panel. Check the connection and retry.',
      retry: 'Retry',
      actionFailed: 'Operation failed: ',

      blockMain: 'Main agent',
      contextLabel: 'Job description',
      contextHint: 'Written into the main agent\'s system prompt; takes effect on the next reply after saving. Subagents are not affected',
      contextPlaceholder: 'For example: lead with the conclusion, then the options; produce a prototype first for any interface change; ask me when unsure.',
      charCount: '{n} / {max}',
      overLimit: '{n} / {max} (over the limit — trim it first)',
      dirty: 'Unsaved',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved; takes effect on the next reply',
      previewTitle: 'Injection preview',
      previewSavedTag: 'Saved content',
      previewDraftTag: 'Draft (unsaved)',
      previewEmpty: '(Empty text: after saving, this section is not injected)',
      previewNote: 'The preview follows the draft while editing; after saving it matches the real injection.',
      verify: 'Verify injection',
      verifying: 'Verifying…',
      verifyOk: 'Injected',
      verifyFail: 'Not injected',
      verifyEmpty: 'No job description yet',

      personaTitle: 'Persona weights',
      personaHint: '0 means that identity is not injected; a higher weight injects a more concrete persona; dragging saves by itself and takes effect on the next reply.',
      personaPreviewTitle: 'Persona injection preview (live)',
      personaValue: '{weight} · {band}',
      personaEmpty: '(All weights are 0: the persona section is not injected)',
      bandNone: 'not injected',
      bandLight: 'brief (1–39)',
      bandMedium: 'medium (40–69)',
      bandFull: 'full (70–100)',
      weightAria: '{label} weight',

      blockTeam: 'Subagent team',
      defaultType: 'Default type',
      defaultTypeHint: 'Delegation that does not use a typed tool (the shipped delegation tools, synchronous delegation, forks, workflow) lands on this type\'s model.',
      newType: 'New type',
      editTypeTitle: 'Edit type · {id}',
      edit: 'Edit',
      remove: 'Delete',
      confirmDeleteBtn: 'Confirm delete',
      cancel: 'Cancel',
      typeEmpty: 'No types yet. Create one, or ask the agent to use the management tools.',
      idLabel: 'Type id (the delegation tool name)',
      idHint: 'Starts with a lowercase letter; lowercase letters, digits, hyphens; up to 32 chars; must not collide with an existing tool.',
      idPlaceholder: 'reviewer',
      descriptionLabel: 'When to use',
      descriptionHint: 'Tells the main agent when to use this type; also seeds the child\'s role prompt.',
      providerLabel: 'Provider',
      pickProvider: 'Pick a provider first',
      modelLabel: 'Model',
      pickModel: 'Pick a model',
      modelLoading: 'Loading models…',
      effortLabel: 'Reasoning effort',
      effortDefault: 'Model default',
      readonlyLabel: 'Read-only (denies bash / write / edit / apply_patch)',
      readonlyTag: 'read-only',
      writableTag: 'writable',
      defaultTag: 'default',
      defaultDeleteHint: 'The default type cannot be deleted; switch the default to another type first.',
      idInvalid: 'Invalid id format',
      descriptionRequired: 'Description must not be empty',
      routeRequired: 'Pick both provider and model',
    }

    async function fetchJson(url, options) {
      const response = await fetch(url, { headers: { accept: 'application/json' }, ...options })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`)
      return data
    }
    const api = {
      state: () => fetchJson(ROUTE_STATE),
      verify: () => fetchJson(ROUTE_VERIFY),
      providers: () => fetchJson(ROUTE_MODELS),
      models: provider => fetchJson(`${ROUTE_MODELS}?provider=${encodeURIComponent(provider)}`),
      mutate: payload => fetchJson(ROUTE_MUTATE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      }),
    }

    /** Fill `{name}` placeholders in one dictionary string. */
    function format(t, key, params) {
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        t(key),
      )
    }

    const styles = {
      page: {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: '14px 14px 20px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        lineHeight: 1.6,
      },
      title: { margin: 0, fontSize: 14, fontWeight: 600, lineHeight: '18px' },
      block: { display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 10 },
      blockTitle: { margin: 0, fontSize: 13, fontWeight: 600 },
      hint: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.5 },
      field: { display: 'flex', flexDirection: 'column', gap: 5 },
      fieldHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
      fieldFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
      label: { fontSize: 12, fontWeight: 600 },
      input: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, fontFamily: 'inherit' },
      textarea: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, minHeight: 132, resize: 'vertical' },
      select: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13 },
      count: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 },
      countOver: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 11, fontWeight: 600 },
      savedFeedback: { margin: 0, color: 'var(--dsw-alias-state-success-primary)', fontSize: 11 },
      badge: { padding: '1px 8px', borderRadius: 999, fontSize: 11, whiteSpace: 'nowrap', border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)' },
      badgeWarn: { padding: '1px 8px', borderRadius: 999, fontSize: 11, whiteSpace: 'nowrap', border: '1px solid var(--dsw-alias-state-warn-primary)', color: 'var(--dsw-alias-state-warn-primary)' },
      badgeOk: { padding: '1px 8px', borderRadius: 999, fontSize: 11, whiteSpace: 'nowrap', border: '1px solid var(--dsw-alias-state-success-primary)', color: 'var(--dsw-alias-state-success-primary)' },
      badgeFail: { padding: '1px 8px', borderRadius: 999, fontSize: 11, whiteSpace: 'nowrap', border: '1px solid var(--dsw-alias-state-error-primary)', color: 'var(--dsw-alias-state-error-primary)' },
      preview: { display: 'flex', flexDirection: 'column', padding: 9, background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8 },
      previewHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
      previewTitle: { fontSize: 11, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' },
      previewBody: { margin: '6px 0 0', maxHeight: 168, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' },
      previewNote: { margin: '6px 0 0', fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      verifyRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      personaSection: { display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 10, borderTop: '1px solid var(--dsw-alias-border-l1)' },
      personaList: { display: 'flex', flexDirection: 'column', gap: 9 },
      personaRow: { display: 'flex', flexDirection: 'column', gap: 3 },
      personaHead: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
      personaLabel: { fontSize: 12, fontWeight: 600 },
      personaTagline: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 },
      personaControls: { display: 'flex', alignItems: 'center', gap: 8 },
      personaSlider: { flex: 1, minWidth: 100, accentColor: 'var(--dsw-alias-brand-primary)' },
      personaValue: { flex: 'none', minWidth: 92, textAlign: 'right', color: 'var(--dsw-alias-label-secondary)', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
      error: { margin: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-state-error-primary)', color: 'var(--dsw-alias-state-error-primary)', fontSize: 12 },
      typeRow: { display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8 },
      typeHead: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
      typeId: { fontFamily: 'ui-monospace, monospace', fontWeight: 600 },
      route: { color: 'var(--dsw-alias-label-secondary)', fontFamily: 'ui-monospace, monospace', fontSize: 11, wordBreak: 'break-all' },
      desc: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 11, lineHeight: 1.5 },
      rowActions: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' },
      form: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8 },
      formTitle: { margin: 0, fontSize: 12, fontWeight: 600 },
      button: { padding: '4px 12px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', fontSize: 12 },
      buttonPrimary: { background: 'var(--dsw-alias-brand-primary)', borderColor: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-bg-base)' },
      buttonText: { padding: '2px 4px', border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', fontSize: 11 },
      buttonTextDanger: { padding: '2px 4px', border: 'none', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 },
      buttonDisabled: { opacity: 0.5, cursor: 'default' },
      checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' },
      actions: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
    }

    /**
     * Contain a render failure to this panel: one broken block must not blank
     * the sidebar slot. The message stays actionable (refresh + console detail).
     */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.error('subagent-types: panel render failed:', error)
      }

      render() {
        if (this.state.failed === true) {
          return h('div', { style: styles.page }, h('p', { style: styles.error }, this.props.message))
        }
        return this.props.children
      }
    }

    /** Sidebar tab icon: one main node above two children, orthogonal connectors. */
    function PanelIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'M8 5.4V7.6M3.4 10.2V7.6H12.6v2.6',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8, cy: 3.2, r: 2.2, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('circle', { cx: 3.4, cy: 12.2, r: 2.1, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('circle', { cx: 12.6, cy: 12.2, r: 2.1, stroke: 'currentColor', strokeWidth: 1.2 }))
    }

    /** How long a slider drag may settle before it is written; no save button, by design. */
    const PERSONA_SAVE_DELAY_MS = 350

    /** Weight → band id, through the Host's bands so the thresholds cannot drift. */
    function bandOf(weight, bands) {
      for (const band of bands) {
        if (weight >= band.min && weight <= band.max) return band.id
      }
      return 'none'
    }

    function bandLabel(t, band) {
      if (band === 'light') return t('bandLight')
      if (band === 'medium') return t('bandMedium')
      if (band === 'full') return t('bandFull')
      return t('bandNone')
    }

    /**
     * Persona weights, inside block A.
     *
     * There is no save button: the drag is the edit (the reviewed prototype's
     * semantics). A drag is debounced into one `setPersonaWeights` write, and the
     * preview is the text the Host rendered from that write — the client never
     * renders persona text itself, and the band labels come from the Host's band
     * table, so neither can drift from the real injection.
     */
    function PersonaSection({ t, persona }) {
      const [weights, setWeights] = React.useState(persona.weights)
      const [preview, setPreview] = React.useState(persona.preview)
      const [failure, setFailure] = React.useState('')
      // Debounce timer, the ticket of the newest drag, and its weights: a reply
      // that lands after a later drag describes weights the sliders already left.
      const timer = React.useRef(null)
      const ticket = React.useRef(0)
      const latest = React.useRef(persona.weights)

      const persist = React.useCallback(async (next, mine) => {
        try {
          const result = await api.mutate({ action: 'setPersonaWeights', weights: next })
          if (ticket.current !== mine) return
          const stored = result?.persona
          if (typeof stored?.preview === 'string') setPreview(stored.preview)
          setFailure('')
        } catch (error) {
          if (ticket.current !== mine) return
          setFailure(String(error?.message ?? error))
        }
      }, [])

      const schedule = (next) => {
        latest.current = next
        ticket.current += 1
        const mine = ticket.current
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          timer.current = null
          void persist(next, mine)
        }, PERSONA_SAVE_DELAY_MS)
      }

      // Switching panels inside the debounce window must not drop the drag.
      React.useEffect(() => () => {
        ticket.current += 1
        if (timer.current === null) return
        clearTimeout(timer.current)
        timer.current = null
        void api.mutate({ action: 'setPersonaWeights', weights: latest.current }).catch(() => {})
      }, [])

      const change = (id, weight) => {
        const next = { ...weights, [id]: weight }
        setWeights(next)
        schedule(next)
      }

      const rows = persona.presets.map((preset) => {
        const weight = weights[preset.id] ?? 0
        return h('div', { key: preset.id, style: styles.personaRow },
          h('div', { style: styles.personaHead },
            h('span', { style: styles.personaLabel }, preset.name),
            preset.tagline ? h('span', { style: styles.personaTagline }, preset.tagline) : null),
          h('div', { style: styles.personaControls },
            h('input', {
              type: 'range',
              min: 0,
              max: persona.maxWeight,
              step: 1,
              value: weight,
              style: styles.personaSlider,
              'aria-label': format(t, 'weightAria', { label: preset.name }),
              onChange: event => change(preset.id, Number(event.target.value)),
            }),
            h('span', { style: styles.personaValue },
              format(t, 'personaValue', { weight, band: bandLabel(t, bandOf(weight, persona.bands)) }))))
      })

      return h('section', { style: styles.personaSection, 'aria-label': t('personaTitle') },
        h('h3', { style: styles.blockTitle }, t('personaTitle')),
        h('p', { style: styles.hint }, t('personaHint')),
        h('div', { style: styles.personaList }, rows),
        failure !== '' ? h('p', { style: styles.error }, t('actionFailed') + failure) : null,
        h('div', { style: styles.preview },
          h('div', { style: styles.previewHead },
            h('span', { style: styles.previewTitle }, t('personaPreviewTitle'))),
          h('pre', { style: { ...styles.previewBody, maxHeight: 200 } },
            preview === '' ? t('personaEmpty') : preview)))
    }

    /**
     * Block A — the main agent's job description.
     *
     * The stored text, the ceiling, and the frame all come from the Host state
     * handed in at mount: after a save the Host trims and returns the canonical
     * text, and that is what the preview and the dirty test compare against.
     * Verification reads the saved text (not the draft), so an unsaved draft
     * keeps the last saved state's answer; saving or editing clears it.
     */
    function ContextBlock({ t, initial, persona }) {
      const [savedText, setSavedText] = React.useState(initial.text)
      const [draft, setDraft] = React.useState(initial.text)
      const [saving, setSaving] = React.useState(false)
      const [saved, setSaved] = React.useState(false)
      const [failure, setFailure] = React.useState('')
      const [verification, setVerification] = React.useState('idle')
      // Incremented by every probe and every save: a probe that comes back
      // after the text changed describes a state the user already left behind.
      const probe = React.useRef(0)

      const maxLength = initial.maxLength
      const frame = initial.frame
      const chars = draft.length
      const overLimit = chars > maxLength
      const dirty = draft !== savedText
      const pending = verification === 'pending'
      const trimmed = draft.trim()

      const save = async () => {
        if (saving || !dirty || overLimit) return
        probe.current += 1
        setSaving(true)
        setFailure('')
        try {
          const result = await api.mutate({ action: 'setContext', text: draft })
          const stored = result?.context
          const text = typeof stored?.text === 'string' ? stored.text : draft.trim()
          setSavedText(text)
          setDraft(text)
          setSaved(true)
          setVerification('idle')
        } catch (error) {
          setFailure(String(error?.message ?? error))
        } finally {
          setSaving(false)
        }
      }

      const verify = async () => {
        if (pending || saving) return
        const ticket = probe.current + 1
        probe.current = ticket
        setFailure('')
        setVerification('pending')
        try {
          const result = await api.verify()
          if (probe.current !== ticket) return
          // Injected wins: a section that made it into the prompt is normal
          // whatever the stored text looks like. An empty stored text is a
          // normal state too — the section is dropped rather than injected.
          if (result?.injected === true) setVerification('ok')
          else if (result?.configured === false) setVerification('empty')
          else setVerification('fail')
        } catch (error) {
          if (probe.current !== ticket) return
          setFailure(String(error?.message ?? error))
          setVerification('idle')
        }
      }

      const verificationBadge = (() => {
        if (verification === 'idle') return null
        if (verification === 'pending') return h('span', { style: styles.badge }, t('verifying'))
        if (verification === 'ok') return h('span', { style: styles.badgeOk }, t('verifyOk'))
        if (verification === 'fail') return h('span', { style: styles.badgeFail }, t('verifyFail'))
        return h('span', { style: styles.badge }, t('verifyEmpty'))
      })()

      return h('section', { style: styles.block, 'aria-label': t('blockMain') },
        h('h2', { style: styles.blockTitle }, t('blockMain')),
        h('div', { style: styles.field },
          h('div', { style: styles.fieldHead },
            h('label', { style: styles.label }, t('contextLabel')),
            dirty ? h('span', { style: styles.badgeWarn }, t('dirty')) : null),
          h('p', { style: styles.hint }, t('contextHint')),
          h('textarea', {
            style: styles.textarea,
            rows: 7,
            spellCheck: false,
            value: draft,
            placeholder: t('contextPlaceholder'),
            onChange: (event) => {
              setDraft(event.target.value)
              setVerification('idle')
            },
          }),
          h('div', { style: styles.fieldFoot },
            h('span', { style: overLimit ? styles.countOver : styles.count },
              format(t, overLimit ? 'overLimit' : 'charCount', { n: chars, max: maxLength })),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...styles.buttonPrimary, ...(saving || !dirty || overLimit ? styles.buttonDisabled : {}) },
              disabled: saving || !dirty || overLimit,
              onClick: save,
            }, saving ? t('saving') : t('save')))),
        saved && !dirty ? h('p', { style: styles.savedFeedback }, t('saved')) : null,
        failure !== '' ? h('p', { style: styles.error }, t('actionFailed') + failure) : null,
        h('div', { style: styles.preview },
          h('div', { style: styles.previewHead },
            h('span', { style: styles.previewTitle }, t('previewTitle')),
            h('span', { style: styles.badge }, dirty ? t('previewDraftTag') : t('previewSavedTag'))),
          h('pre', { style: styles.previewBody }, trimmed === '' ? t('previewEmpty') : `${frame}${trimmed}`),
          h('p', { style: styles.previewNote }, t('previewNote'))),
        h('div', { style: styles.verifyRow },
          h('button', {
            type: 'button',
            style: { ...styles.button, ...(pending || saving ? styles.buttonDisabled : {}) },
            disabled: pending || saving,
            onClick: verify,
          }, t('verify')),
          verificationBadge,
          verification === 'fail'
            ? h('button', { type: 'button', style: styles.buttonText, onClick: verify }, t('retry'))
            : null),
        h(PersonaSection, { t, persona }))
    }

    function emptyForm() {
      return { id: '', description: '', provider: '', model: '', effort: '', readonly: false }
    }

    /**
     * Block B — the subagent type registry.
     *
     * Same semantics as the former settings card: the id is editable only on
     * create, the description is required, the default type cannot be deleted
     * (and says why), deletion takes two steps, and switching provider or model
     * resets the narrower choices below it.
     */
    function TeamBlock({ t, types, defaultType, reload }) {
      const [providers, setProviders] = React.useState([])
      const [modelsByProvider, setModelsByProvider] = React.useState({})
      const [editor, setEditor] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [actionError, setActionError] = React.useState('')
      const [deleteArm, setDeleteArm] = React.useState('')

      React.useEffect(() => {
        api.providers().then(result => setProviders(result.providers ?? [])).catch(() => {})
      }, [])

      const loadModels = React.useCallback(async (provider) => {
        if (provider === '' || modelsByProvider[provider] !== undefined) return
        try {
          const result = await api.models(provider)
          setModelsByProvider(previous => ({ ...previous, [provider]: result.models ?? [] }))
        } catch {
          setModelsByProvider(previous => ({ ...previous, [provider]: [] }))
        }
      }, [modelsByProvider])

      const openCreate = () => {
        setActionError('')
        setDeleteArm('')
        setEditor({ mode: 'create', form: emptyForm() })
      }
      const openEdit = (type) => {
        setActionError('')
        setDeleteArm('')
        setEditor({
          mode: 'edit',
          form: {
            id: type.id,
            description: type.description,
            provider: type.provider,
            model: type.model,
            effort: type.reasoningEffort ?? '',
            readonly: type.readonly,
          },
        })
        loadModels(type.provider)
      }
      const patchForm = (patch) => {
        setEditor(previous => previous === null ? previous : { ...previous, form: { ...previous.form, ...patch } })
      }
      const formProblem = (form, mode) => {
        if (mode === 'create' && !ID_RE.test(form.id)) return t('idInvalid')
        if (form.description.trim() === '') return t('descriptionRequired')
        if (form.provider === '' || form.model === '') return t('routeRequired')
        return null
      }
      const saveEditor = async () => {
        if (editor === null || busy) return
        const form = editor.form
        const problem = formProblem(form, editor.mode)
        if (problem !== null) { setActionError(problem); return }
        setBusy(true)
        setActionError('')
        try {
          const payload = editor.mode === 'create'
            ? { action: 'create', id: form.id, description: form.description, provider: form.provider, model: form.model, readonly: form.readonly, reasoningEffort: form.effort === '' ? null : form.effort }
            : { action: 'update', id: form.id, description: form.description, provider: form.provider, model: form.model, readonly: form.readonly, reasoningEffort: form.effort === '' ? null : form.effort }
          await api.mutate(payload)
          setEditor(null)
          await reload()
        } catch (error) {
          setActionError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }
      const armDelete = (id) => {
        if (busy) return
        setActionError('')
        setDeleteArm(id)
      }
      const removeType = async (id) => {
        if (busy) return
        setBusy(true)
        setActionError('')
        setDeleteArm('')
        try {
          await api.mutate({ action: 'delete', id })
          if (editor?.form.id === id) setEditor(null)
          await reload()
        } catch (error) {
          setActionError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }
      const changeDefault = async (id) => {
        if (busy || id === defaultType) return
        setBusy(true)
        setActionError('')
        try {
          await api.mutate({ action: 'setDefault', id })
          await reload()
        } catch (error) {
          setActionError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }

      const button = (label, onClick, extra = {}, disabled = false) => h('button', {
        type: 'button',
        style: { ...styles.button, ...(extra.style ?? {}), ...(disabled || busy ? styles.buttonDisabled : {}) },
        disabled: disabled || busy,
        onClick,
      }, label)

      const rowActions = (type) => {
        const isDefault = type.id === defaultType
        if (deleteArm === type.id) {
          return h('div', { style: styles.rowActions },
            h('button', { type: 'button', style: styles.buttonTextDanger, onClick: () => removeType(type.id) }, t('confirmDeleteBtn')),
            h('button', { type: 'button', style: styles.buttonText, onClick: () => setDeleteArm('') }, t('cancel')))
        }
        return h('div', { style: styles.rowActions },
          h('button', { type: 'button', style: styles.buttonText, onClick: () => openEdit(type) }, t('edit')),
          h('button', {
            type: 'button',
            style: isDefault ? { ...styles.buttonText, opacity: 0.5, cursor: 'default' } : styles.buttonText,
            disabled: isDefault || busy,
            title: isDefault ? t('defaultDeleteHint') : '',
            onClick: () => armDelete(type.id),
          }, t('remove')))
      }

      const editorForm = editor === null ? null : (() => {
        const form = editor.form
        const models = modelsByProvider[form.provider]
        const selectedModel = (models ?? []).find(model => model.id === form.model)
        const efforts = selectedModel?.efforts ?? []
        const title = editor.mode === 'create' ? t('newType') : format(t, 'editTypeTitle', { id: form.id })
        return h('section', { style: styles.form, 'aria-label': title },
          h('h3', { style: styles.formTitle }, title),
          editor.mode === 'create'
            ? h('div', { style: styles.field },
              h('label', { style: styles.label }, t('idLabel')),
              h('input', {
                style: styles.input,
                value: form.id,
                placeholder: t('idPlaceholder'),
                onChange: event => patchForm({ id: event.target.value.trim() }),
              }),
              h('p', { style: styles.hint }, t('idHint')))
            : null,
          h('div', { style: styles.field },
            h('label', { style: styles.label }, t('descriptionLabel')),
            h('textarea', {
              style: { ...styles.input, minHeight: 52, resize: 'vertical' },
              value: form.description,
              onChange: event => patchForm({ description: event.target.value }),
            }),
            h('p', { style: styles.hint }, t('descriptionHint'))),
          h('div', { style: styles.field },
            h('label', { style: styles.label }, t('providerLabel')),
            h('select', {
              style: styles.select,
              value: form.provider,
              onChange: (event) => {
                const provider = event.target.value
                patchForm({ provider, model: '', effort: '' })
                loadModels(provider)
              },
            },
              h('option', { value: '' }, t('pickProvider')),
              providers.map(provider => h('option', { key: provider.id, value: provider.id }, provider.name)))),
          h('div', { style: styles.field },
            h('label', { style: styles.label }, t('modelLabel')),
            h('select', {
              style: styles.select,
              value: form.model,
              disabled: form.provider === '' || models === undefined,
              onChange: event => patchForm({ model: event.target.value, effort: '' }),
            },
              h('option', { value: '' }, models === undefined && form.provider !== '' ? t('modelLoading') : t('pickModel')),
              (models ?? []).map(model => h('option', { key: model.id, value: model.id }, model.name)))),
          h('div', { style: styles.field },
            h('label', { style: styles.label }, t('effortLabel')),
            h('select', {
              style: styles.select,
              value: form.effort,
              disabled: selectedModel === undefined,
              onChange: event => patchForm({ effort: event.target.value }),
            },
              h('option', { value: '' }, t('effortDefault')),
              efforts.map(effort => h('option', { key: effort.id, value: effort.id }, effort.name)))),
          h('label', { style: styles.checkboxRow },
            h('input', {
              type: 'checkbox',
              checked: form.readonly,
              onChange: event => patchForm({ readonly: event.target.checked }),
            }),
            t('readonlyLabel')),
          h('div', { style: styles.actions },
            button(t('cancel'), () => { setEditor(null); setActionError('') }),
            button(busy ? t('saving') : t('save'), saveEditor, { style: styles.buttonPrimary }, formProblem(form, editor.mode) !== null)))
      })()

      return h('section', { style: styles.block, 'aria-label': t('blockTeam') },
        h('h2', { style: styles.blockTitle }, t('blockTeam')),
        types.length === 0
          ? h('p', { style: styles.hint }, t('typeEmpty'))
          : h('div', { style: styles.field },
            h('label', { style: styles.label }, t('defaultType')),
            h('select', {
              style: styles.select,
              value: defaultType,
              disabled: busy,
              onChange: event => changeDefault(event.target.value),
            }, types.map(type => h('option', { key: type.id, value: type.id }, type.id))),
            h('p', { style: styles.hint }, t('defaultTypeHint'))),
        types.map(type => h('div', { key: type.id, style: styles.typeRow },
          h('div', { style: styles.typeHead },
            h('span', { style: styles.typeId }, type.id),
            h('span', { style: styles.badge }, type.readonly ? t('readonlyTag') : t('writableTag')),
            type.id === defaultType ? h('span', { style: styles.badgeWarn }, t('defaultTag')) : null,
            rowActions(type)),
          h('span', { style: styles.route }, `${type.provider}/${type.model}${type.reasoningEffort ? ` · ${type.reasoningEffort}` : ''}`),
          h('p', { style: styles.desc }, type.description))),
        types.length === 0 ? null : h('p', { style: styles.hint }, t('defaultDeleteHint')),
        h('div', { style: styles.actions }, button(t('newType'), openCreate, { style: styles.buttonPrimary })),
        editorForm,
        actionError !== '' ? h('p', { style: styles.error }, t('actionFailed') + actionError) : null)
    }

    /**
     * The panel: one state read feeds both blocks, so a load failure is
     * reported once and retried in place.
     */
    function OrganizationPanel({ t }) {
      const [data, setData] = React.useState(null)
      const [status, setStatus] = React.useState('loading')

      const load = React.useCallback(async () => {
        setStatus(previous => (previous === 'ready' ? 'refreshing' : 'loading'))
        try {
          const state = await api.state()
          if (typeof state?.context?.text !== 'string' || !Array.isArray(state?.types)) {
            throw new Error('incomplete state')
          }
          // The persona half of block A: weights, the Host's band table, and the
          // Host-rendered preview are all required — a missing one would blank
          // the sliders or invent thresholds.
          const persona = state.persona
          if (persona === null || typeof persona !== 'object'
            || typeof persona.weights !== 'object' || persona.weights === null
            || typeof persona.preview !== 'string'
            || typeof persona.maxWeight !== 'number'
            || !Array.isArray(persona.presets) || !Array.isArray(persona.bands)) {
            throw new Error('incomplete persona state')
          }
          setData(state)
          setStatus('ready')
        } catch {
          setStatus('error')
        }
      }, [])
      React.useEffect(() => { load() }, [load])

      const title = h('h1', { style: styles.title }, t('panel'))
      if (status === 'loading') {
        return h('div', { style: styles.page }, title, h('p', { style: styles.hint }, t('loading')))
      }
      if (status === 'error') {
        return h('div', { style: styles.page },
          title,
          h('p', { style: styles.error }, t('loadFailed')),
          h('div', { style: styles.actions }, h('button', { type: 'button', style: styles.button, onClick: load }, t('retry'))))
      }
      return h('div', { style: styles.page },
        title,
        h(ContextBlock, { key: 'context', t, initial: data.context, persona: data.persona }),
        h(TeamBlock, {
          key: 'team',
          t,
          types: data.types,
          defaultType: data.defaultType ?? '',
          reload: load,
        }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'subagent-types: dictionaries')

        // The panel is wrapped so one failing block cannot blank the slot.
        const AgentOrganizationPanel = (props) => h(
          PanelBoundary,
          { message: props.t('panelFailed') },
          h(OrganizationPanel, props),
        )
        // Keyed slot: the panel registers by `key`.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, AgentOrganizationPanel))

        // Sidebar tab: the icon rail registers by `id`, beside the other panels.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 25,
          label: () => t('panel'),
          locale: NS,
        }, PanelIcon))
      },
    }
  },
})
