# SQL EXPLAIN AI 分析 API（explain-ai）

CMDB 后端 SQL 查询模块的执行计划 AI 分析功能。用户在 SQL 查询页对一条 `EXPLAIN` 语句发起分析请求后，后端会：

1. 严格校验 SQL（仅接受单条 `EXPLAIN` 语句）；
2. 通过 Agent 执行 EXPLAIN 获取执行计划；
3. 采集本次查询实际关联表的结构元数据（DDL + 表级统计信息）；
4. 调用已配置的 AI 厂商（OpenAI 兼容协议）流式生成优化分析报告，并以 SSE 实时推送给前端。

> **安全约束（必须遵守）**：
> 1. 仅接受 `EXPLAIN` 语句，其余一切语句（SELECT/UPDATE/DELETE/DDL 等）一律拒绝；
> 2. 不执行、不上传任何业务数据，仅采集表结构与统计信息元数据；
> 3. AI 分析仅基于 EXPLAIN 执行计划与关联表的元数据；
> 4. 后端执行通道严格执行白名单管控（仅 EXPLAIN / SHOW CREATE TABLE / SHOW TABLE STATUS 三类语句）。

---

## 通用约定

### 鉴权

| 项 | 值 |
|---|---|
| 认证方式 | JWT（SSE 接口支持 `Authorization: Bearer <token>` 头 或 `token` query 参数） |
| 权限标识 | `sql:search:r` |
| 菜单路径 | `/sql/search`（项目权限按该菜单过滤） |
| 项目权限 | 非超级管理员（role.Level != 0）时校验 `agent` 项目在可访问项目列表内，否则返回 403 |

> SSE 接口路径在 JWT 白名单中，鉴权在 Handler 内部完成：token 优先取 `Authorization` 头，其次取 `token` query 参数。

### 统一响应（非流式部分）

前置校验失败时返回标准 JSON（HTTP 状态码非 200），不会进入 SSE 流：

```json
{
  "code": 401,
  "message": "token无效: xxx",
  "data": null
}
```

### 通用错误码

| 状态码 | 含义 |
|---|---|
| 400 | 参数错误（必填字段缺失、SQL 校验不通过、AI 未配置等） |
| 401 | 未提供 token / token 无效 |
| 403 | 缺少 `sql:search:r` 权限 / 无权访问该项目 |
| 405 | 请求方法不允许 |
| 500 | 服务器内部错误 / 当前服务不支持 SSE |

---

## 1. AI 厂商配置（系统设置）

分析功能依赖系统设置中的 AI 厂商配置，需先完成配置再调用分析接口。

### 1.1 获取基础设置

```
GET /api/system/setting/basic
```

| 项 | 值 |
|---|---|
| 权限 | `system:setting:r` |
| 菜单路径 | 无须校验项目 |

**响应示例（仅列出 AI 相关字段）**：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 1,
    "ai_enabled": true,
    "ai_base_url": "https://api.deepseek.com/v1",
    "ai_api_key": "sk-a****bcde",
    "ai_model": "deepseek-chat"
  }
}
```

> `ai_api_key` 返回的是**掩码值**（前 4 位 + `****` + 后 4 位；长度 ≤ 8 时返回 `****`；未配置时返回空串）。

### 1.2 更新基础设置

```
POST /api/system/setting/basic/update
```

| 项 | 值 |
|---|---|
| 权限 | `system:setting:w` |
| Content-Type | `application/json` |

**请求体（仅列出 AI 相关字段，实际需提交完整设置对象）**：

```json
{
  "id": 1,
  "ai_enabled": true,
  "ai_base_url": "https://api.deepseek.com/v1",
  "ai_api_key": "sk-xxxxxxxxxxxxxxxx",
  "ai_model": "deepseek-chat"
}
```

> **掩码回传机制**：`ai_api_key` 提交值中若包含 `****`（即前端展示的掩码原样回传），后端视为「不修改」，保留数据库中原值；提交新明文则覆盖。

### 1.3 AI 配置字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `ai_enabled` | bool | 是否启用 AI 分析。未启用时调用分析接口返回 400：`AI分析未启用，请在系统设置中开启并配置AI厂商` |
| `ai_base_url` | string | AI 服务地址（OpenAI 兼容）。填到 `/v1` 或 `/api/v3` 级别即可，后端自动拼接 `/chat/completions`；也兼容直接填完整 `/chat/completions` 地址 |
| `ai_api_key` | string | AI 服务 API Key |
| `ai_model` | string | 模型名称，如 `deepseek-chat`、`qwen-plus`、`gpt-4o-mini` |

**常见厂商填写示例**：

| 厂商 | ai_base_url | ai_model 示例 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 豆包（火山方舟） | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-xxx`（推理接入点 ID） |
| Kimi（月之暗面） | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:14b` |

> 数据库变更：AI 配置字段位于 `sys_settings` 表（`ai_enabled` / `ai_base_url` / `ai_api_key` / `ai_model`），增量脚本见 `script/alter_ai_settings.sql`。

### 1.4 获取 AI 模型列表

从 AI 厂商拉取可用模型列表（调用厂商 OpenAI 兼容的 `GET /models` 接口），供设置页选择模型。厂商地址与密钥由前端传入（保存前也可获取）；API Key 传掩码或空时自动使用系统设置中已保存的明文。

```
POST /api/system/setting/ai/models
```

| 项 | 值 |
|---|---|
| 权限 | `system:setting:w` |
| Content-Type | `application/json` |

**请求体**：

```json
{
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxxxxxxxxxxxxxxx"
}
```

> - `base_url` 必填；`api_key` 可传空（本地 Ollama 等免鉴权服务）。
> - `api_key` 传掩码值（`sk-1****abcd`，即获取设置接口回填后未修改的展示值）或空时，后端自动使用系统设置中已保存的明文（与更新设置的掩码回传机制一致）；用户重新输入的明文优先使用。

**响应示例**：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 2,
    "models": [
      { "id": "deepseek-chat", "owned_by": "deepseek" },
      { "id": "deepseek-reasoner", "owned_by": "deepseek" }
    ]
  }
}
```

> - `models` 按 `id` 升序排序；部分厂商不返回 `owned_by` 时为空串。
> - 地址拼接规则与 AI 分析一致：填到 `/v1` 或 `/api/v3` 级别即可，后端自动拼接 `/models`；也兼容直接填完整 `/chat/completions` 地址（自动替换为 `/models`）。
> - `api_key` 为空时不携带 `Authorization` 头，兼容本地 Ollama 等免鉴权服务。

**错误响应**：

| HTTP | message 示例 | 说明 |
|---|---|---|
| 400 | `请先填写AI服务地址` | 请求体 `base_url` 为空 |
| 400 | `AI服务地址格式不正确，需以 http:// 或 https:// 开头` | 地址非法（仅允许 http/https） |
| 500 | `获取系统设置失败` | `api_key` 为掩码/空时读取已保存配置失败 |
| 502 | `请求AI服务失败: ...` | 网络不通/连接失败（超时 15s） |
| 502 | `AI服务返回错误(401): ...` | 厂商鉴权失败，检查 API Key |
| 502 | `解析AI服务响应失败，请确认服务地址兼容OpenAI协议` | 厂商响应不是 OpenAI 兼容格式 |

---

## 2. EXPLAIN AI 分析（SSE 流式）

### 2.1 接口说明

```
GET  /sse/sql/explain/analyze?token=xxx&agent=xxx&dbName=xxx&query=xxx
POST /sse/sql/explain/analyze          （推荐，query 较长时避免 URL 长度限制）
```

| 项 | 值 |
|---|---|
| 认证 | JWT（Header `Authorization: Bearer <token>` 优先，其次 `token` query 参数） |
| 权限 | `sql:search:r` |
| 项目权限 | 按 `/sql/search` 菜单校验 `agent` 项目访问权 |
| POST 请求体上限 | 1 MB |
| 整体超时 | 5 分钟 |
| 心跳 | 每 15 秒推送一次 `heartbeat` 事件，防止网关掐断空闲长连接 |

**SSE 响应头**：

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Access-Control-Allow-Origin: *
X-Accel-Buffering: no
```

### 2.2 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `agent` | string | 是 | 项目标识符 |
| `dbName` | string | 是 | 数据库名称 |
| `query` | string | 是 | 待分析的 **EXPLAIN 语句**（必须是单条 EXPLAIN 开头的语句） |
| `tables` | string[] | 否 | 前端解析出的本次查询关联表，用于补充 EXPLAIN 无法提取表的场景（如 FORMAT 变体）。后端会将其与 EXPLAIN 计划表合并去重，并同样经过白名单清洗（跨库跳过 / 系统表过滤 / 异常字符拒绝）。GET 请求用逗号分隔：`tables=a,b,c` |

> 关联表来源优先级：EXPLAIN 计划中的表（优化器实际访问，保持连接顺序）→ 前端传入的 `tables`（去重补充）→ 仅当两者均未提取到任何物理表时，后端才兜底解析原始 SQL。最终采集哪些表的元数据以 `done` 事件返回的 `tables` 为准。

**POST 请求体示例**：

```json
{
  "agent": "bxhd",
  "dbName": "bxhd_order",
  "query": "EXPLAIN SELECT p.id, d.amount FROM sys_credit_repayment_plan p LEFT JOIN sys_credit_repayment_detail d ON p.id = d.plan_id WHERE p.status = 1",
  "tables": ["sys_credit_repayment_plan", "sys_credit_repayment_detail"]
}
```

**GET 示例**：

```
GET /sse/sql/explain/analyze?token=<jwt>&agent=bxhd&dbName=bxhd_order&query=EXPLAIN%20SELECT%20...&tables=a,b,c
```

### 2.3 SQL 准入校验规则（严格模式）

请求中的 `query` 需依次通过以下校验，任一不通过返回 **400**（普通 JSON，不建立 SSE）：

| # | 规则 | 不通过时的错误信息 |
|---|---|---|
| 1 | 非空 | `query字段不能为空` / `SQL不能为空` |
| 2 | 必须以 `EXPLAIN` 开头（词边界，大小写不敏感） | `仅允许分析 EXPLAIN 语句，请提交以 EXPLAIN 开头的查询` |
| 3 | 拒绝多语句（字符串/反引号字面量之外的裸分号） | `检测到多条语句，仅允许单条 EXPLAIN 查询` |
| 4 | 拒绝 `EXPLAIN ANALYZE`（会真实执行查询） | `安全限制：不支持 EXPLAIN ANALYZE（会真实执行查询），请使用标准 EXPLAIN` |
| 5 | EXPLAIN 的对象必须是 SELECT/WITH 查询（`EXPLAIN UPDATE/DELETE` 拒绝） | `EXPLAIN 仅支持分析 SELECT 查询，当前对象类型: xxx` |
| 6 | EXPLAIN 后必须跟有语句 | `EXPLAIN 后缺少待分析的 SELECT 语句` |

**允许的写法**（通过校验）：

- `EXPLAIN SELECT ...`、`explain select ...`、`Explain Select ...`
- `EXPLAIN FORMAT=JSON SELECT ...`、`EXPLAIN FORMAT = TREE SELECT ...`
- `EXPLAIN EXTENDED PARTITIONS SELECT ...`
- `EXPLAIN WITH cte AS (...) SELECT ...`
- 末尾一个分号（如 `EXPLAIN SELECT 1;`）
- 子查询内部含 `LIMIT 1`、字符串常量含分号（如 `WHERE name = 'a;b'`）

### 2.4 SSE 事件协议

事件流格式为标准的 `event: <name>\ndata: <json>\n\n`。事件顺序如下：

```
connected → stage(explain) → stage(meta) → stage(ai) → delta × N → done
```

任意阶段异常时推送 `error` 事件后结束；期间穿插 `heartbeat` 心跳事件。

| 事件 | data 字段 | 说明 |
|---|---|---|
| `connected` | `message` | 连接建立成功 |
| `stage` | `stage`, `message` | 阶段提示：`explain`（正在执行 EXPLAIN）/ `meta`（正在采集表元数据）/ `ai`（AI 正在分析） |
| `delta` | `content` | AI 输出的增量文本片段（需按顺序拼接） |
| `done` | `message`, `model`, `took`, `tables` | 分析完成。`took` 为总耗时（毫秒）；`tables` 为本次实际采集元数据的关联表名列表 |
| `error` | `message` | 分析失败（EXPLAIN 执行失败 / AI 调用失败等） |
| `heartbeat` | `timestamp` | 心跳（15 秒一次，前端可忽略） |

**事件流示例**：

```
event: connected
data: {"message":"连接成功"}

event: stage
data: {"stage":"explain","message":"正在执行 EXPLAIN 获取执行计划..."}

event: stage
data: {"stage":"meta","message":"正在采集 2 张表的元数据（行数/大小/结构）..."}

event: stage
data: {"stage":"ai","message":"AI 正在分析执行计划..."}

event: delta
data: {"content":"## 结论摘要\n"}

event: delta
data: {"content":"1. 该查询存在全表扫描..."}

event: done
data: {"message":"分析完成","model":"deepseek-chat","took":18320,"tables":["orders","users"]}
```

**error 事件示例**：

```
event: error
data: {"message":"执行EXPLAIN失败: Agent返回错误: Table 'xxx.orders' doesn't exist"}
```

### 2.5 错误信息汇总

**前置校验（HTTP 状态码 + JSON 响应）**：

| 场景 | 状态码 | 信息 |
|---|---|---|
| 未提供 token | 401 | `未提供token` |
| token 无效 | 401 | `token无效: xxx` |
| 缺少 `sql:search:r` 权限 | 403 | `没有访问权限` |
| 无权访问该项目 | 403 | `无权访问该项目` |
| 参数缺失 | 400 | `agent字段不能为空` / `dbName字段不能为空` / `query字段不能为空` |
| SQL 校验不通过 | 400 | 见 2.3 表格 |
| AI 未启用 | 400 | `AI分析未启用，请在系统设置中开启并配置AI厂商` |
| AI 地址未配置 | 400 | `AI服务地址未配置` |
| AI Key 未配置 | 400 | `AI服务API Key未配置` |
| AI 模型未配置 | 400 | `AI模型名称未配置` |
| 不支持 SSE | 500 | `当前服务不支持SSE` |

**SSE 流内（error 事件）**：

| 场景 | message 示例 |
|---|---|
| EXPLAIN 执行失败 | `执行EXPLAIN失败: Agent返回错误: xxx` |
| EXPLAIN 无结果 | `EXPLAIN 未返回执行计划数据` |
| AI 服务调用失败 | `调用AI服务失败: xxx` |
| AI 服务返回异常 | `AI服务返回异常(HTTP 401): Invalid API key` |
| AI 流内错误 | `AI服务返回错误: xxx` |
| 客户端断开 / 整体超时（5 分钟） | 不推送 error 事件，连接直接结束，同时记录失败审计 |

> 前端在收到 `done` 事件之前若流关闭，应视为异常处理（提示用户重试）。

### 2.6 元数据采集范围（上传给 AI 的内容）

后端仅采集**本次查询实际关联的表**（以 EXPLAIN 计划中出现的表为唯一权威来源，保持连接顺序）的结构元数据，**不含任何业务数据**：

| 内容 | 来源 | 说明 |
|---|---|---|
| 执行计划 | EXPLAIN 结果 | 用户提交的 EXPLAIN 语句的执行计划（优化器预估，非实际执行数据） |
| 表结构 DDL | `SHOW CREATE TABLE` | 字段类型、注释、索引定义、表注释、引擎、字符集 |
| 表级统计信息 | `SHOW TABLE STATUS` | 仅白名单字段：`Name/Engine/Version/Row_format/Rows/Avg_row_length/Data_length/Index_length/Auto_increment/Collation/Create_time/Update_time/Comment` |

**限制与过滤**：

- 最多采集 10 张表，超出时仅提供前 10 张并在提示词中提示"未提供的表请勿臆测"；
- 关联表来源（优先级）：EXPLAIN 计划中的表 → 前端传入的 `tables` → 后端解析原始 SQL 兜底；
- 系统表与敏感表（`ShouldFilterTable` 过滤规则）不采集、不发送；前端传入的 `tables` 同样经过该过滤；
- 派生表/子查询虚拟表（`<derivedN>`）不采集；
- 元数据采集失败的表会在提示词中标注"采集失败"，AI 需明确说明信息不足。

### 2.7 AI 分析报告结构

AI 输出为 Markdown 文本（通过 `delta` 增量推送），固定结构如下：

1. **结论摘要**：3-5 条要点（执行效率、主要瓶颈、最关键优化动作）；
2. **执行计划解读**：按表解读 type/key/possible_keys/rows/filtered/Extra，说明驱动表与被驱动表角色；
3. **问题清单**：全表扫描、索引失效、回表过多、排序/临时表开销、隐式类型转换、表达式包裹字段、条件书写形式与复合索引最左前缀不匹配等；
4. **优化建议（三类）**：
   - **写法优化**（语义等价的书写习惯改写，即使执行计划正常也会指出）：如 `date(create_time) = '2026-01-01'` → `create_time >= '2026-01-01' AND create_time < '2026-01-02'`；`from_unixtime(t) >= '...'` → `t >= unix_timestamp('...')`；
   - **条件顺序与索引匹配**：复合索引未完整使用时的语义等价小改动建议，并输出调整后的完整 SQL；
   - **缺失索引**：确有需要时给出 `ALTER TABLE ... ADD INDEX` 语句（`idx_` 前缀命名）；
   - 每条建议标注类别、依据、风险等级，并按收益与实施风险排优先级；
5. **补充说明**：信息不足时明确说明需补充的结构类信息。

> AI 被约束为"仅基于提供的信息分析"，严禁要求或推断任何业务数据内容，不得编造未提供的表/字段/索引。

### 2.8 前端对接示例

**方式一：fetch 流式读取（推荐，支持 POST 与自定义头）**

```js
const resp = await fetch('/sse/sql/explain/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + jwtToken
  },
  body: JSON.stringify({
    agent: 'bxhd',
    dbName: 'bxhd_order',
    query: 'EXPLAIN SELECT ...',
    tables: ['sys_credit_repayment_plan', 'sys_credit_repayment_detail'] // 可选：前端解析出的关联表
  })
})

if (!resp.ok) {
  const err = await resp.json()   // 前置校验失败：普通 JSON 响应
  console.error(err.message)
  return
}

const reader = resp.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
let report = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })

  // 按空行切分事件块
  let idx
  while ((idx = buffer.indexOf('\n\n')) >= 0) {
    const block = buffer.slice(0, idx)
    buffer = buffer.slice(idx + 2)

    let event = 'message', dataStr = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
    }
    if (!dataStr) continue
    const data = JSON.parse(dataStr)

    switch (event) {
      case 'stage':     /* 更新进度：data.stage / data.message */ break
      case 'delta':     report += data.content; /* 渲染增量 markdown */ break
      case 'done':      /* 完成：data.took / data.model / data.tables */ break
      case 'error':     /* 失败：data.message */ break
      case 'heartbeat': /* 忽略 */ break
    }
  }
}
```

**方式二：EventSource（仅 GET）**

```js
const url = `/sse/sql/explain/analyze?token=${encodeURIComponent(jwtToken)}`
          + `&agent=${agent}&dbName=${dbName}&query=${encodeURIComponent(explainSQL)}`
const es = new EventSource(url)

es.addEventListener('stage', e => { /* ... */ })
es.addEventListener('delta', e => { report += JSON.parse(e.data).content })
es.addEventListener('done',  e => { console.log(JSON.parse(e.data)); es.close() })
es.addEventListener('error', e => { if (e.data) console.error(JSON.parse(e.data).message); es.close() })
```

> 注意：URL 长度有限（一般 8KB 以内），`query` 较长时请使用方式一。

### 2.9 审计

#### 2.9.1 SQL 审计流水

每次分析请求都会写入 SQL 审计（`operation = ai_analyze`）：

- 成功：记录原始 EXPLAIN 语句、项目、数据库、耗时、状态 `success`；
- 失败：记录失败原因（EXPLAIN 执行失败 / AI 调用失败 / 连接中断或超时等），状态 `failed`。

#### 2.9.2 AI 调用记录（独立审计）

系统同时将每次 AI 调用写入独立的 AI 调用记录表 `audit_ai_log`（成功与失败均记录），用于「审计管理 → AI调用记录」页面查看调用明细与用量；**不保存 AI 分析结果内容**。

记录字段（响应中为 camelCase）：

| 字段 | 说明 |
|---|---|
| `userId` / `userName` | 操作人（谁操作） |
| `createdAt` | 操作时间 |
| `project` / `dbName` | 项目标识 / 数据库名 |
| `querySql` | 分析的 EXPLAIN 语句 |
| `tables` | 本次查询关联表（逗号分隔） |
| `model` | AI 模型 |
| `promptTokens` / `completionTokens` / `totalTokens` | token 用量 |
| `duration` | 总耗时（毫秒） |
| `status` / `errorMessage` | 调用状态（success/failed）与失败原因 |
| `clientIp` / `country` / `region` / `city` / `district` / `platform` | 客户端来源与平台 |

**token 用量获取**：请求自动携带 `stream_options.include_usage` 参数，读取流末尾 chunk 的 usage 统计；若厂商不支持该参数（返回 400 且错误提及 stream_options），后端自动降级重试一次，本次 token 记为 0，不影响分析功能。

**列表接口**：

```
POST /api/audit/ai/list
```

| 项 | 值 |
|---|---|
| 认证 | JWT（Header `Authorization: Bearer <token>`） |
| 权限 | `audit:ai:r` |
| 可见范围 | 超级管理员（角色 level=0）可见全部；普通用户仅可见自己的记录 |

请求体（均可选；`page` 默认 1；`pageSize` 默认 20、最大 100）：

```json
{
  "userName": "", "project": "", "dbName": "", "model": "",
  "status": "", "startTime": "", "endTime": "",
  "page": 1, "pageSize": 20
}
```

响应：

```json
{
  "code": 200,
  "message": "请求成功",
  "data": {
    "total": 1,
    "list": [
      {
        "id": 1, "userId": 1, "userName": "admin", "project": "bxhd", "dbName": "bxhd_order",
        "querySql": "EXPLAIN SELECT ...", "tables": "sys_credit_repayment_plan,sys_credit_repayment_detail",
        "model": "deepseek-chat",
        "promptTokens": 1520, "completionTokens": 890, "totalTokens": 2410,
        "duration": 18320, "status": "success", "errorMessage": "",
        "clientIp": "10.0.0.1", "country": "中国", "region": "广东", "city": "深圳", "district": "",
        "platform": "web", "createdAt": "2026-10-10T10:00:00+08:00"
      }
    ],
    "page": 1, "pageSize": 20, "totalPages": 1
  }
}
```

**启用方式**：

1. 执行 `script/create_audit_ai_log.sql` 建表；
2. 在「菜单管理」新增菜单（权限标识 `audit:ai:r`）并给角色授权（脚本尾部附参考 SQL）。

---

## 3. 部署与调试注意事项

1. **数据库变更**：需先执行 `script/alter_ai_settings.sql`（为 `sys_settings` 增加 4 个 AI 字段）与 `script/create_audit_ai_log.sql`（新建 AI 调用记录表），再部署新版本；
2. **AI 厂商**：任何兼容 OpenAI Chat Completions 协议（`POST /chat/completions`，`stream: true`）的服务均可接入，无需额外 SDK；
3. **SSE 网关**：接口已设置 `X-Accel-Buffering: no`，nginx 侧无需额外配置即可流式透传；若走多层代理，仍需保证不缓冲响应；
4. **超时**：整体 5 分钟（后端硬超时），前端可自行设置更短的展示超时；
5. **重试**：分析失败（error 事件）后可整链路重试；`delta` 已接收的内容不建议拼接混合，应重新渲染。
