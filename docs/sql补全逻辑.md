# SQL 补全逻辑

> 范围：`src/pages/Sql/Search`（SQL 查询页面）+ `src/utils/sql`（补全核心库）
> 基于 ACE 编辑器（`ace-builds` + `ext-language_tools`）的自定义 completer 实现。

---

## 一、整体架构

```
用户输入
  │
  ├─ SqlEditor.tsx（ACE 实例，每个 Tab 独立绑定 completer）
  │     ├─ change 事件 → 增量维护 sqlValueRef / lineStarts（applyAceDelta）
  │     ├─ 防抖 180ms 重建 SqlDocumentIndex（语句边界 + 行起点索引）
  │     └─ '.' 键绑定 dotAndComplete 命令 → 插入点号后主动触发补全
  │
  └─ createSqlCompleter（src/utils/sql/index.ts）
        getCompletions(editor, session, pos, prefix, callback)
          1. 定位光标所在语句（documentIndex 优先，回退 session 逐行扫描）
          2. 解析语句上下文（表名/别名，带缓存）
          3. 分支：点号补全 / 普通补全
          4. 候选生成：关键字、函数、库名、表名、字段、别名
          5. 前缀索引 + 增量匹配过滤
          6. 去重取最优（MAX_SUGGESTIONS = 100，见第七节说明，增量过滤下上限对性能无影响）
          7. 附加图标/颜色/类型标签 → 自定义渲染器展示
```

元数据（库/表/字段/注释）全部走**本地缓存**（`window.sqlMetadataCache`、`window.sqlFieldSuggestions`），补全过程不发请求；缓存由页面切换项目/库时预加载并持久化到 `states.dat`。

---

## 二、编辑器层（SqlEditor.tsx）

### 1. ACE 配置
- `enableBasicAutocompletion` + `enableLiveAutocompletion`（delay 120ms，threshold 1）
- `enableSnippets: false`

### 2. 每个 Tab 独立 completer
`editor.completers = [completer]` 显式绑定，**不使用 language_tools 全局 completer 列表**，避免多个 SQL Tab 互相覆盖上下文。

### 3. 输入路径性能处理
- `change` 事件中用 `applyAceDelta` 增量拼接文本与行起点数组，避免每次输入 `getValue()` 全文扫描；
- 文档索引 `buildSqlDocumentIndex` **防抖 180ms** 重建；普通字符/数字输入不立即失效旧索引（只有删除、换行、分号才立即失效），保证连续输入可复用上一份索引的语句/上下文缓存；
- 快速连续输入（间隔 < 100ms）时 `completer.detach()` 暂停弹窗，停顿 180ms 后再 `startAutocomplete`，避免逐字重渲染候选项；
- 回车键自动关闭补全弹窗；
- 内容变化防抖 500ms 才同步到 React state（自动保存），失焦立即同步。

### 4. 点号触发（sqlEditorUtils.ts `createDotHandler`）
绑定 `.` 键命令：插入 `.` 后 `setTimeout 50ms` 主动 `execCommand('startAutocomplete')`，实现 `表名.` / `别名.` / `库名.` 立即弹出候选。

---

## 三、补全主流程（src/utils/sql/index.ts）

### 1. 语句定位
- 有文档索引时：`positionToDocumentOffset` + `getStatementRangeAtOffset`（二分）定位光标所在语句区间，**只取语句起点到光标之间的文本** `stmtToCursor`（避免旧索引 end 截断当前 token）；
- 无索引时（索引尚未建好）：`getSessionStatementAtCursor` 从 Ace session 逐行向前找分号，只拼当前语句片段，不扫全文。

### 2. 语句上下文（statementContext.ts）
- `createStatementContext`：对光标前的语句文本调用 `extractTablesFromStatement` 提取表名列表与别名映射（alias 小写 → 表名）；
- completer 内部按 `statementStart:contextInput` 做键缓存，同一 token 的连续补全请求不重复解析；

### 3. 上下文分析（parser.ts `analyzeContext`）
判断光标所处子句 `clause`：
- 依次识别 DELETE / UPDATE / INSERT / SELECT 四类语句；
- SELECT 内部再按 LIMIT > ORDER BY > GROUP BY > WHERE > FROM > SELECT 的位置比较定位子句；
- 末尾匹配 `JOIN xxx$` 时标记为 `JOIN`；
- 同时输出 `isAfterDot` / `dotIdentifier` / `previousWord` / `isAfterNumber`。

### 4. 点号补全分支（优先级最高）
光标行匹配 `(\w+)\.\w*$` 时：
1. **库名. → 表列表**：identifier 命中 `getAllCachedDatabases()` 时，返回 `getDbTables(db)` 的模糊匹配结果（score 8000+）；
2. **表名/别名. → 字段列表**：`getDotCompletions`（completers/dot.ts）
   - 别名先通过 `tableAliases`（语句解析 + 上下文解析合并）还原为真实表名；
   - `getTableFields(表名, 当前库)` 取缓存字段，裸表名按当前库优先命中，避免跨库同名表串字段；
   - 逐条 `fuzzyMatch` 过滤后取最优。

### 5. 普通补全分支
`prefix` 为空直接返回空（不提示）。候选来源按上下文区分：

| 上下文 | 候选来源 | 基础分 |
|---|---|---|
| 任意 | SQL 关键字（ALL_KEYWORDS 全集） | WHERE 3000 / FROM·JOIN 4000 / 其他 10000，另加 `KEYWORD_PRIORITY * 10` |
| 非 FROM/JOIN | SQL 函数（补全值带 `()`） | WHERE 4000 / 其他 9000 |
| FROM / JOIN | 库名（跨库前缀输入） | 8500 |
| FROM / JOIN | 当前库表名（`getCachedTableCompletionIndex`） | 8000 |
| 非 FROM/JOIN | 光标前已写表的字段（按语句中表顺序，主表权重高，每张表 -500） | WHERE 14000 / 其他 11000 |
| 非 FROM/JOIN | 表别名 | WHERE 9800 / 其他 8500 |

- 字段候选来自 `getCachedFieldCompletionIndex(短表名, 库名)`，字段匹配在 `prefix.length < 3` 时不限数量、≥ 3 时限制每批 30 条再过滤；
- 非 FROM 子句**不提示表名/库名**（只提示已出现在语句中的表的字段），减少无关噪音。

### 6. 结果整形（renderer.ts）
- `selectTopSuggestions` 去重（同名取高分）后取 Top-N，`MAX_SUGGESTIONS = 100`（详见第七节第 1 条）；
- 为每项附加 `iconText`（⚡/ƒ/🗄️/📋/●/§）、`iconColor`、`typeLabel`（中文类型）；
- `getDocTooltip` 生成 docHTML：字段名、类型、所属表（从 comment 的 `[表名]` 提取）、注释、主键 🔑 标识；
- `createCustomRenderer` 自定义下拉项 DOM：图标色块 + 名称。

### 7. 防过期回调
completer 内部维护 `completionGeneration` 计数，`getCompletions` 回调返回时若已有更新的请求发起，则回空结果，防止旧请求覆盖新结果；另带 > 5ms 的分阶段性能打点日志。

---

## 四、匹配与增量过滤

### fuzzyMatch（matcher.ts）评分规则（从高到低）
1. 前缀完全匹配：`200 - min(len, 50)`
2. 包含匹配：`100 - 位置`
3. 下划线分段首字母匹配（`ct` → `created_time`）：70
4. 驼峰首字母匹配（`cT` → `createdTime`）：60
5. 字符顺序子序列匹配：`50 - 紧凑度惩罚`

### 前缀索引 + 增量匹配（prefixIndex.ts `matchIncremental`）
- 候选按**首字母分桶**建立 `PrefixIndex`（WeakMap 按源数组引用缓存），前缀直查只扫一个桶；
- 增量链（chain）：prefix 变长时在上一轮命中结果上继续过滤（候选只减不增），纯前缀命中用 `startsWith`，不调 fuzzyMatch。因此真正的计算开销集中在首字符的第一次全量过滤（如从 1000 中筛出命中集），后续输入只是在小结果集上再过滤，这也是候选上限放宽到 100 以内几乎无性能影响的原因；
- prefix 回退（删字符）时直接复用历史层级结果；
- **模糊匹配仅在 prefix ≥ 3 个字符、且前缀命中数 < fuzzyMin 时启用**；启用后模糊结果满足单调性，后续仍可增量过滤；
- 候选源变化（namesRef / candidateKey 不一致）时自动重置该 scope 的状态。

### 补全索引缓存（completionIndex.ts）
- 字段/表候选数组 + names + 前缀索引按 key 缓存（字段按 `db.table` 归一化 key，表按 TableInfo 数组引用 WeakMap）；
- 元数据写入时 `invalidateCompletionIndexes()` 递增版本号使字段索引失效。

---

## 五、元数据缓存（cache.ts + 页面 index.tsx）

### 存储结构（挂 window，供 Tauri WebView 内存共享）
- `window.sqlMetadataCache`：
  - `databases`：库名列表
  - `dbTables`：库 → 表名数组（双键：原名 + 小写）
  - `tableStats`：表行数/数据大小（db.table 与裸表名双键）
  - `tableComments`：表注释（db.table 精确键优先，裸表名回退）
- `window.sqlFieldSuggestions`：表 → `FieldInfo[]`（裸表名、小写、`db.table`、`db.table` 小写四键写入）

### 字段读取（fieldLookup.ts `resolveCachedFields`）
优先级：`db.table` 精确键 → 原名 → 裸表名 → 大小写变体扫描 → 旧版仅有限定键时的后缀匹配。

### 加载时机（Sql/Search/index.tsx）
1. **切换项目**：先 `restoreMetadataFromStorage`（states.dat，版本 1.1 校验）→ 命中即用；未命中调 `getDatabases` API 全量拉取 → `cacheDatabases` / `cacheDbTables` / `cacheTableComment` / `cacheTableStats` / `cacheTableFields` → `persistMetadataToStorage` 落盘；
2. **启动后首次进入某项目**：`clearMetadataStorage` 清旧缓存并强制重新拉取，保证注释最新；
3. **切换 Tab / 恢复工作区**：内存无库列表时后台静默恢复，并按 tab.tableList 从文件补字段；
4. **切换库**：内存表列表 → 文件 dbTables → API 三级回退；
5. **手动刷新元数据**：重走 `fetchAndCacheMetadata`。

### 按需加载兜底（SqlWorkspace.tsx `loadTableStructure`）
缓存缺字段时可调 `getTableStructure` API 单表拉取，转换为 FieldInfo 后写回 `window.sqlFieldSuggestions`（附 dbName）。

---

## 六、表名/别名提取（tableExtractor.ts）

- `extractTablesFromStatement`：去注释 → 正则截取 `FROM ... 到下一个主子句关键字（WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/UNION/结尾）` → 末尾无空格且多词时丢弃最后一个"输入中"的词 → `parseFromClause` 解析；
- 支持：单表、逗号多表、隐式别名（`users u`）、`AS` 别名、各类 JOIN、跨库 `db.table`；第二个词是 SQL 关键字时不当作别名；
- `getSessionStatementAtCursor`：无文档索引时的轻量语句定界（只向前找分号，不向后扫全文）；
- 另维护 `tabTableRegistry`（tabId → 已确认表名集合，`FROM 表名 空格` 才算确认）。

---

## 七、关键设计要点

1. **候选上限（MAX_SUGGESTIONS）**：当前代码为 `100`。由于匹配走增量链，首次全量过滤后结果已缓存，后续每次输入只在上一轮命中集合上继续收窄（候选只减不增），把上限控制在 100 以内前端计算量几乎没有差异，且保留了可选性（曾取值 `1` 只保留最优一条，过于保守，已恢复为 100）；
2. **多 Tab 隔离**：每个编辑器实例独立 completer + 独立实例级增量 scope（`editor:{id}:statement:{start}:token:{pos}`）；
3. **三级定位**：文档索引（防抖预建）→ session 逐行扫描 → 全文 `lastIndexOf(';')`；
4. **跨库安全**：裸表名读取字段/注释时校验归属库，防止同名表串数据；所有写入采用 db.table + 裸表名双键；

---

## 八、文件索引

| 文件 | 职责 |
|---|---|
| `pages/Sql/Search/components/SqlEditor.tsx` | ACE 封装、completer 绑定、输入性能处理 |
| `pages/Sql/Search/components/sqlEditorUtils.ts` | SQL 格式化、点号触发命令 |
| `pages/Sql/Search/index.tsx` | 元数据加载/恢复/持久化调度 |
| `pages/Sql/Search/components/SqlWorkspace.tsx` | `loadTableStructure` 按需拉取 |
| `utils/sql/index.ts` | `createSqlCompleter` 主入口 |
| `utils/sql/documentIndex.ts` | 语句边界/行起点索引 |
| `utils/sql/statementContext.ts` | 语句表名/别名上下文及缓存 |
| `utils/sql/parser.ts` | 子句上下文分析 |
| `utils/sql/tableExtractor.ts` | 表名/别名提取 |
| `utils/sql/keywords.ts` | 关键字分类与权重 |
| `utils/sql/matcher.ts` | 模糊匹配、去重、Top-N |
| `utils/sql/prefixIndex.ts` | 前缀索引 + 增量匹配 |
| `utils/sql/completionIndex.ts` | 候选数组缓存与失效 |
| `utils/sql/cache.ts` | 元数据缓存与持久化 |
| `utils/sql/fieldLookup.ts` | 字段缓存多键解析 |
| `utils/sql/completers/dot.ts` | 点号补全（库.表 / 表.字段） |
| `utils/sql/renderer.ts` | 图标/颜色/tooltip/自定义渲染 |
