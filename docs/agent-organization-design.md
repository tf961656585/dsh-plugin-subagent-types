---
type: design-doc
status: 已收口
---

# agent 组织插件升级设计

「子代理类型」插件扩展为「agent 组织」：一个左侧面板统管主 agent 的岗位说明（含合并后的用户画像）与子代理团队。本文档是切片 1–3 的共享契约；内部标识符一律保留现名，只改用户可见层。

## 1. 已拍板前提

| 前提 | 结论 | 依据 |
|---|---|---|
| 与用户画像插件的关系 | 合并进本插件，画像插件退役 | 2026-11-18 用户拍板（看板 pm-e8013f2c；memory decisions.md#dec-20261118-63f47ab2） |
| 岗位说明生效范围 | 全局一份（profile 级） | 同上（pm-a70cacaf） |
| 管理入口 | 只留左侧面板，移除 Plugins 页设置卡片 | 同上（pm-fdbbed53），升级 pm-a05621aa 的卡片形态决定 |
| 内部命名 | 包名、存储域 subagent_types、路由前缀 /plugin/subagent-types、工具名 *_subagent_type 全部保留 | 改名会使用户现有配置失联（调查核实：~/.dsh/storages/subagent_types.json 是唯一权威） |
| 岗位说明编辑权 | 仅用户在面板编辑；不提供模型工具，agent 不可自改 | 本轮方案默认，用户未反对 |
| 画像对子代理的注入 | 保持现状（子代理继续收到画像段） | 本轮方案默认，用户未反对 |
| 类型骨架 | 类型 = 纯委派策略、型号唯一归类型注册表，不动 | memory decisions.md#dec-20261117-2405f792 |

## 2. 身份与命名

- 展示名：zh「agent 组织」，en「Agent Organization」。落点：locale/zh.json、locale/en.json 的 meta.title / meta.description（Plugins 页列表展示用）。
- 图标：组织结构概念（一个主节点 + 两个子节点的连线图），替换 icon.svg；左侧 tab 图标用同一概念的内联 SVG 组件。
- README：重写为升级后的功能与安装说明。
- 不变：package.json name、host.js export name、cordis.patch.yml entry、存储域 subagent_types、既有工具名、既有 section 名 subagent-types 与 subagent-type:persona。

## 3. 切片划分与文件所有权

| 切片 | 交付 | 允许动的文件 |
|---|---|---|
| 1 主机端 | 岗位说明存储 + 注入 + 路由 + 自证 + 测试 + 两处清理 | host.js、lib/context.js（新）、test/context.test.mjs（新）、README.md（仅修旧说法一行） |
| 2 界面 | 左侧面板（类型管理搬入 + 岗位说明编辑）、设置卡片移除、品牌层 | client.js、package.json（dsh.client.inject）、locale/*、icon.svg、README.md（重写）、cordis.patch.yml（如需） |
| 3 吸收画像 | 权重滑条进面板、存储迁移、画像插件退役 | host.js、lib/、client.js、test/、storage 迁移；画像插件目录只读 |

切片 2 的产品代码在原型评审通过后才动；切片 1 与原型制作可并行。

## 4. 切片 1 契约：主机端

### 4.1 存储

- 新 storageDomain 单元 `agent_context`，version 1，global 记录 `{ text: string }`，initial `{ text: '' }`。
- 独立于 subagent_types 域（该域无迁移代码，同域加表需手写 v2 迁移，弃用）。
- 读写复用 host.js 现有 domain 装配模式（请核实 host.js:115-124 的现有写法）。

### 4.2 纯模块 lib/context.js

- `CONTEXT_MAX_LENGTH = 20000`（字符数上限，防提示膨胀；UI 显示字数，超限报错文案指明上限）。
- `normalizeContextText(input)`：仅字符串合法；修剪首尾空白，保留内部换行。
- `contextProblems(text)`：返回问题列表（非字符串、超上限），文案风格对齐 lib/contract.js typeProblems。
- `renderContextSection(text, origin)`：
  - origin === 'subagent' → 返回 ''（否定式过滤：只排除子代理，其余一律注入——诊断性装配时 agent 缺席，肯定式会漏）；
  - 规范化后为空 → 返回 ''；
  - 否则返回 FRAME + text。FRAME 固定为：`## 主 agent 岗位说明（用户定义）\n以下内容是用户为你（主 agent）定义的岗位职责与工作偏好：\n`。
- 不引入优先级措辞（与画像段的语义协调留到切片 3 合并时，两段同面板可见后再定）。

### 4.3 注入

- 全局 ctx 注册一个 section：`{ name: 'agent-organization:context', order: 30, interpolate: false, text: (context) => renderContextSection(当前存储文本, context?.agent?.session?.header?.origin) }`。
- origin 字段路径必须核实：对照 host.js 现有顶层工具校验的 origin 取法（请核实 host.js:263-267）与 dsh-agent 源码（AssembleContext 由 dsh-agent/src/dispatch.ts:174-176 传入 `{ agent, scope, signal }`）。
- text 每步重算：编辑保存后下一个模型请求生效；空文本段自动丢弃；system 消息在 compaction 后保留（机制证据：dsh-system-prompt/lib/index.js:255-258,389,120；dsh-agent-loop/lib/index.js:692-696,259-285）。
- 存储读取必须同步廉价：若 domain API 异步，用模块级缓存（init 载入 + mutate 时更新），不得在 text 函数里做异步等待。
- apply 时注册一次，cleanup 时 disposer；同名 section 同层重复注册会抛错，名字带命名空间。

### 4.4 路由（扩展现有 /plugin/subagent-types/*）

- `GET /state`：payload 追加 `context: { text, maxLength, frame }`（向后兼容，现卡片忽略未知字段）。maxLength 与 frame 由 host 下发，客户端禁止硬编码上限与 FRAME 文案（防第二事实源）。
- `POST /mutate`：新增 action `setContext`，payload `{ text }`；走 contextProblems 校验，错误响应格式对齐现有 action。清空必须传 `''`，传 null 按非字符串拒绝。
- `GET /verify`（新）：调 `systemPrompt.assemble({})` 做诊断装配，检查 name='agent-organization:context' 的段是否出现，返回 `{ injected: boolean, configured: boolean, name, length }`。configured=存储文本非空；injected=false 且 configured=false 是「空文本不注入」的正常态，不是链路故障；length 为装配出的段落长度（FRAME+正文）。自证写法参照 dsh-user-persona/host.js:329-346。
- 不新增模型工具。

### 4.5 测试

- test/context.test.mjs：覆盖 normalize（修剪/非字符串）、problems（超限/合法）、render（子代理过滤、空文本、FRAME 拼接、agent 缺席仍注入）。
- 既有 36 个测试保持全绿；命令 `node --test test/*.test.mjs`，退出码 + 落盘日志为准。

### 4.6 清理与疑点（随切片 1）

- README:17「显式路由覆盖被尊重」与 lib/routing.js 实现相反，改为与实现一致的一句话（完整重写留切片 2）。
- guidance 疑点已定性（切片 1 调查）：段注册无 origin 过滤，子代理提示实际包含该段；观察者会话早于插件上线，疑点不成立。但发现真实不一致：正文让子代理读到只有顶层才能执行的管理工具指令。处置：guidance text 改 origin 感知——子代理版本去掉管理工具指引段、保留类型清单与委派语义；顶层与 agent 缺席时正文逐字不变。
- 实现层发现：storageDomain.open 无条件解引用 spec.tables，新单元必须显式声明 `tables: {}`。

## 5. 切片 2 契约：界面（原型评审通过后实现）

### 5.1 左侧 tab

- 双 slot 注册：`sidebar.panellist`（字段用 **id**='agent-organization'，order: 25，label: t('panel')，图标组件）+ `main`（字段用 **key**='agent-organization'，面板组件）。id/key 写反是静默失效。
- package.json `dsh.client.inject` 追加 `@deepseek-ai/dsh-client-ui-layout`、`@deepseek-ai/dsh-client-ui-sidebar`。
- 移除 `plugins.bundle.config` 注册（设置卡片退役）；locale meta 保留。
- 面板外层套错误边界（参照 pm-board PanelBoundary）；容器 height:100%;min-height:0;overflow:auto，自带 padding。

### 5.2 面板信息架构

单面板两块，纵向排列，单列布局（面板窄，现设置页双列表单重排为单列）：

**块 A「主 agent」**
- 岗位说明编辑器：多行 textarea + 字数统计（上限 20000）+ 显式保存按钮 + 未保存标记（dirty）。
- 保存反馈：「已保存，下一次回复起生效」。
- 注入预览：只读展示 FRAME + 当前文本（编辑时随输入更新预览，保存后与真实注入一致）。
- 「验证注入」按钮 → GET /verify → 三态：configured=false 显示「未填写岗位说明」（正常态）；injected=true 显示「注入正常」；configured=true 且 injected=false 显示「未注入」+ 重试。
- 画像权重滑条区（0–100，含实时预览）：**切片 3 才实现**；原型展示终态并标注「切片 3」。

**块 B「子代理团队」**
- 现 TypesPage 能力原样搬入：默认类型下拉、类型行（名字/线路/力度/只读）、新建/编辑表单（单列）、删除两次确认。
- 加载/错误重试/busy 状态复用现有模式。

### 5.3 文案要点（zh，en 对应翻译）

- 面板标题「agent 组织」；块 A「主 agent」；块 B「子代理团队」。
- 编辑器标签「岗位说明」；说明「写入主 agent 的系统提示，保存后下一次回复生效；子代理不受影响」。
- 空态占位：「例如：回复先给结论再给选项；涉及界面改动先出原型；不确定时先问我。」
- 验证按钮「验证注入」；结果「注入正常」/「未注入」。
- 生效口径一律写「下一次回复」，不得写「下一轮对话」或「新会话」。

### 5.4 视觉与适配

- 生产用 `--dsw-alias-*` token（浅深色自动跟随）；原型用 prototypes/shared/tokens.css。
- 窄屏：<768px 侧栏变抽屉由 layout 负责；面板内部单列 + flex wrap 兜底。
- 图标轨道收起态只有 tooltip（label），展开态显示文字。

### 5.5 生效链路

- 纯 JS 动态加载，无构建；改 client.js 后刷新页面生效，无效则重启应用（host JS 换代需重启或 remove+install 热重装）。
- 验收步骤按「刷新 → 无效则重启」写。

## 6. 切片 3 契约：吸收画像

### 6.1 存储与迁移

- 新 storageDomain 单元 `user_persona`，version 1，global `{ weights: object }`，initial `{ weights: {} }`，显式 `tables: {}`。
- apply 时若 weights 为空且旧文件可读 → 导入（create-if-absent：此后存储编辑优先，不再读旧文件）。旧文件路径解析顺序与源插件一致（$DSH_PROFILE_DIR/user-persona.json → $DSH_HOME/user-persona.json → ~/.dsh/user-persona.json，请核实 dsh-user-persona/host.js:214-220）。旧文件保留不删，作回退。
- 权重合法域：0–100 整数，键为预设身份 id；校验文案风格对齐 contextProblems。

### 6.2 渲染与注入

- lib/persona.js（新纯模块）：从 dsh-user-persona/host.js 逐字移植 FRAME（:33-46）、5 个预设身份与三档文本（:53-159）、排序与拼接规则（:191-211，最高权重为主段、其余各一行、0 不注入）。
- 字节一致测试：把源插件原函数拷入测试参照，多组权重组合（含 {pm:80,design:40} 实测值、全 0、单身份、并列权重）断言输出逐字相等。
- section：name 'agent-organization:persona'，order 20，interpolate:false，全局注册，**不过滤子代理**（保持现状）。与旧插件同名会冲突，故用新命名空间名；切换窗口内两段并存属预期瞬态。

### 6.3 路由与界面

- /state 追加 `persona: { weights, presets: [{id, name}], maxWeight: 100, preview }`；/mutate setPersonaWeights 响应回传同形 persona 快照。预设清单与预览文本均由 host 渲染下发，客户端禁止硬编码身份或复制渲染逻辑（防第二事实源）。
- /mutate 新增 action `setPersonaWeights`，payload `{ weights }`。
- 面板块 A 追加画像权重滑条区：交互与保存语义以已评审原型为准（prototypes/agent-organization/context-block.js 的滑条区），文案逐字（档位「简版/中档/完整」，阈值 1–39/40–69/70–100，0 不注入）；去掉原型里的「切片 3 实现」标注。
- 优先级措辞决定：不加硬编码优先级句；岗位说明与画像两段均用户可编辑，同面板预览可见冲突，由用户自行协调。

### 6.4 退役顺序（主 agent 执行，不在实现子代理边界内）

1. 热重装本插件（remove+install link）→ 诊断装配验证 persona 段与旧插件输出字节一致。
2. remove dsh-plugin-user-persona（用户已拍板合并，含退役）。
3. 验证：旧 tab 消失、主 agent 提示仍含画像段且文本不变、旧 JSON 文件仍在、左侧图标总数不变。

### 6.5 验收（用户动作）

滑条拖动与保存可用、画像注入文本与合并前一致（主 agent 引用对照）、旧插件与旧 tab 消失无残留、旧文件仍在。

## 7. 验收标准（用户动作）

- 切片 1：看活体证据确认——编辑一段文本后 verify 显示已注入、主 agent 下一次回复携带该文本、子代理提示里查无该文本；测试全绿。
- 切片 2：先评审原型（明确说「通过」）→ 实现后按验收单操作：左侧 tab 出现并点开、类型增删改与默认类型、岗位说明编辑/保存/预览/验证、设置卡片消失、深色模式与窄屏。
- 切片 3：画像文本与合并前一致、滑条可用、旧插件与旧 tab 消失无残留、旧文件仍在。

## 8. 继承面与清理清单

| 对象 | 处置 | 时点 |
|---|---|---|
| README:17 旧说法 | 修正一行 | 切片 1 |
| README 全文 | 重写 | 切片 2 |
| locale meta.title/description | 改展示名 | 切片 2 |
| icon.svg | 新图标 | 切片 2 |
| guidance 段正文 | 若提及设置页入口则同步改口径 | 切片 2 |
| memory dec-20261117-2405f792「管理双 surface」 | 切片 2 落地后更新为实现现状 | 切片 2 |
| 画像插件全部产物 | 退役删除（旧 JSON 文件保留） | 切片 3 |
| 设置卡片注册 | 删除，不留双入口 | 切片 2 |

## 9. 风险与未核实项

- 活体客户端 slots 探针本轮超时：tab 契约来自官方 README + 4 个本地先例，切片 2 实现时活体验证。
- complete:true 段风险已排除：切片 1 调查核实出厂包不存在 complete:true 段。
- host 接线零单测覆盖：注入/路由靠活体冒烟（标记文本 → verify → 主 agent 自查 → 子代理报告）。
- 原型治理偏差声明：agent-behaviour 仓库 README 明确轻治理（无 spec 体系、决策进 memory、过程进原型头注），本升级沿用该约定，不初始化 docs/design-registry.yaml；原型登记以 prototypes/README.md 清单为准。

## 10. 证据索引（调查蒸馏，2026-11-18）

- 注入通道：dsh-system-prompt/lib/index.js:255-258,389,120,382；dsh-agent/src/dispatch.ts:174-176、runtime-types.ts:18-30；dsh-agent-loop/lib/index.js:692-696,259-285；memory dependencies.md#dep-20261118-d57dd28a。
- 画像先例：dsh-user-persona/host.js:355-362（注册）、:329-346（verify）、:214-220（文件存储）。
- tab 先例：dsh-pm-board/client.js:2176-2189、dsh-memory/client.js:1396-1408、dsh-process-guard/client.js:691-704；ui-sidebar README:42、ui-layout README:36。
- 本插件现状：host.js:32-46,115-124,158-210,263-267,366-370,384-465；lib/ 四模块；client.js:390-402（卡片注册）。
- 踩坑：memory pitfalls.md#pit-20261118-d72049cb（peerDeps/ALS）、#pit-20261118-eba55001（keyed 槽 key）。