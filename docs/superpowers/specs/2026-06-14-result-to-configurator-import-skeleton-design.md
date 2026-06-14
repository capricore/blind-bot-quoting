# 子项目 4 — Result → 配置器导入（Walking Skeleton）设计

> 日期：2026-06-14 · 作者：Yan Yan（与 Claude 协作）
> 所属大功能：blind-bot installer → quote service 的跳转/登录/导入打通（共 4 个子项目 + 1 条白标横切线）
> 本 spec 只覆盖**子项目 4 的 walking skeleton**：把"installer 结果 → quote 配置器"这条管道端到端先跑通。

## 1. 背景与目标

零售商在 blind-bot 的 installer 里配置并渲染出一个结果（result）。我们要在 result 页加一个按钮，跳转到独立的 quote service，把结果**图片**和**所选配置**带过去，落到对应产品线的配置器页面，作为报价的起点。

**本期目标**：先把这条管道端到端跑通（walking skeleton），可演示。**不**追求产品/颜色/遮光的真实映射与自动预选——那些留到后续"产品对齐"期。

**硬约束（横切，全程贯穿）**：零售商在 quote service 看到的页面**不得出现任何 BlindBot 痕迹**，对外呈现为"另一家公司的产品"。内部知道两者相连。完整白标是单独的工作线（见 §6 与任务 6），本期只做零成本的那部分。

## 2. 范围

**做**
- blind-bot result 页加按钮（仅 roller shade / drapery 两类产品显示）。
- 按钮把"图片 URL + 所选配置 + 产品线"通过 URL 参数带到 quote service。
- quote service 按产品线落到默认产品配置页，显示结果图片 + "导入的设计"参考清单。

**明确不做（本期推迟）**
- 真正的产品/颜色/遮光/选项映射与**自动预选**（保留一个 no-op 接缝）。
- 落到"具体哪一款"的细粒度产品映射（本期用产品线默认款）。
- 图片代理 + id 化 handoff（即 §"后续"里的 (i) 方案）与由此带来的**完整白标**。
- 登录 / 用户开通 / 按邮箱关联（子项目 2、3）。
- 把导入数据持久化入库。
- quote 应用整体的去 BlindBot 品牌改造（任务 6）。
- 客户信息（email/name/phone）透传。

## 3. 关键设计决策（已与用户确认）

| # | 决策 | 取舍说明 |
|---|---|---|
| D1 | 导入定位为**省事的起点（best-effort）**，不追求 100% 还原 | 两套产品/颜色/遮光词汇对不齐，且 blind-bot 无尺寸；本期不强求映射 |
| D2 | handoff 用 **(ii) inline 参数**（数据直接放 URL），不回调 blind-bot | 最快跑通、不依赖登录；后续无痛升级到 (i) id+回调 |
| D3 | 配置器对导入数据**只展示、不自动选**（"导入的设计"参考面板） | 自动选需要被推迟的映射；展示面板正是以后自动预选的数据入口 |
| D4 | 白标只做零成本项（中性文案 + `noreferrer` + 中性参数名），**图片来源暂可见** | 彻底藏来源（图片代理 + id 化参数）和升级到 (i) 一起做才完整 |
| D5 | 按钮**仅在 roller shade / drapery 结果出现**；其他品类无入口 | 兜底问题在源头消解，quote 端永不会收到无对应产品的情况 |
| D6 | quote 端按产品线落到**默认产品配置页**：卷帘→`rs-aria`，窗帘→`dp-velluto` | 占位默认款，可能后续更换；只需粗分类规则，不需逐款映射表 |

## 4. 数据契约（URL 参数）

跳转目标：
```
http://localhost:3000/configure/<默认产品>?line=<line>&img=<图片URL>&cfg=<选配JSON>
```
- `<默认产品>`：`rs-aria`（line=roller-shade）或 `dp-velluto`（line=drapery）。
- `line`：`roller-shade` | `drapery`。
- `img`：result 图片 URL（本期直接用原始 URL，接受地址栏可见）。
- `cfg`：blind-bot 的 options 扁平字典，`JSON.stringify` 后 URL 编码（如 `{color, translucency, lighting, valance, structure, control, extras, openness, mountType, texture, hemStyle}`，键集合以实际为准）。
- 参数名一律中性，**不出现 `blindbot`**。
- 客户信息本期不带。

## 5. 改动点

### 5.1 blind-bot 侧（最小按钮）
- 在 result 数据 in-scope 处加按钮（shared-ui 的 `ResultStep`，或 `app/(dashboard)/installer-portal/page.tsx` 能拿到 result 的位置）。
- 仅当结果产品归类为 roller shade / drapery 时渲染；按钮按分类拼出上面的 URL 并跳转。
- 链接加 `rel="noreferrer"`（避免 Referer 泄漏来源域名）。
- **开放项**：① blind-bot 用哪个字段/取值区分 roller vs drapery（规划阶段查代码确认）；② 按钮放 shared-ui（涉及版本/yalc 引入）还是 app 层注入点（规划阶段定）。

### 5.2 quote service 侧（主要改动，均在本仓库）
- `app/configure/[productId]/page.tsx`（服务端组件，已支持 `await searchParams`）：解析 `img`/`cfg`/`line`，作为 props 传给 `Configurator`；无参数时行为不变（向后兼容直接访问）。
- `components/Configurator.tsx`：新增**"你的设计 / Imported design"卡片**（中性标题），显示 `img` 图片 + 把 `cfg` 原始键值原样列出（"颜色: X / 遮光: Y / …"）。**不写入表单状态、不自动选。**
- 导入数据**仅本次渲染期有效**，不入库。

### 5.3 映射接缝（关键扩展点）
- 新增 `lib/import.ts`，导出 `mapImportedConfig(cfg)`：**本期返回 `{}`（no-op）**。
- 这是以后做真正自动预选的**唯一扩展点**：届时让它返回 `{ colorId, opacityId, options, dimensions? }`，配置器据此预选；展示面板与表单初始化共用这一个来源。

## 6. 白标措施（本期范围内）
- 中性 URL 参数名（`img`/`cfg`/`line`）。
- 中性卡片文案（不出现 BlindBot）。
- 入站链接 `rel="noreferrer"`。
- **不在本期**：图片代理（用 quote 自己域名转出图片）、id 化参数、quote 应用整体改名换 logo——这些归"完整白标"，随 (i) handoff 升级一起做（任务 6 跟踪）。

## 7. 验收标准
1. 在 blind-bot 配出一个 **roller shade** 结果 → result 页出现按钮 → 点击 → 新开 quote 配置器，落在 `rs-aria`，页面显示该 result 图片 + "你的设计"参考清单 → 可正常调尺寸、出报价。
2. 同上换 **drapery** 结果 → 落在 `dp-velluto`，表现一致。
3. **非** roller/drapery 结果 → result 页**不显示**该按钮。
4. quote 端整页**无任何 BlindBot 字样**。
5. 直接访问 `/configure/rs-aria`（无导入参数）→ 行为与改动前一致（向后兼容）。

## 8. 测试与验证方式
- quote service 无测试套件。采用手动验证：用样例参数手工拼一个 `/configure/rs-aria?line=roller-shade&img=...&cfg=...` URL，确认参考面板正确渲染、报价照常工作；并确认无参数访问不受影响。
- blind-bot 侧：在 installer 跑出一个 roller/drapery 结果，确认按钮出现且跳转 URL 拼装正确（含 `noreferrer`）。

## 9. 明确推迟 / 后续
- **(i) handoff 升级**：跳转只带一个 id（+临时凭证），quote 端调 blind-bot 已有的 `GET /api/render-history/:id` 取数；地址栏不再含原始 URL。
- **完整白标**：图片代理端点（带来源域名白名单、防 SSRF）+ id 化参数 + quote 应用整体改名/换 logo/换配色。随 (i) 一起到位。
- **真实映射**：`mapImportedConfig` 从 no-op 升级为真实的产品/颜色/遮光/选项映射与自动预选；落到具体款而非产品线默认款。
- **登录 / 开通 / 按邮箱关联**：子项目 2、3。
- **"Continue with BlindBot" 按钮命名**：与白标冲突，子项目 2 解决（改中性名 或 定位成第三方身份源）。

## 10. 待规划阶段确认的开放项
- O1：blind-bot 区分 roller vs drapery 的具体字段/取值。
- O2：result 按钮的落点（shared-ui `ResultStep` vs app 层）及对 shared-ui 版本流程的影响。
- O3：`cfg` 实际包含哪些键（以 result 真实数据为准），用于参考面板展示。
