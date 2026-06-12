# 审计模块接口文档

## 基础说明

- 基础路径：`/api/audit`
- 认证：JWT Token（Header: `Authorization: Bearer xxx`）
- 响应格式：`{ "code": 200, "message": "xxx", "data": {} }`

---

## 1. 审计分析 `/audit/analysis`

### 1.1 获取审计分析数据

- **方法**：GET
- **路径**：`/api/audit/analysis`
- **参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_time | string | 是 | 开始时间，格式 `2026-06-10 00:00:00` |
| end_time | string | 是 | 结束时间，格式 `2026-06-10 23:59:59` |

- **响应 `data` 结构**：

```json
{
  "top_executors": [
    {
      "nick_name": "张三",
      "execution_count": 100,
      "web_count": 80,
      "desktop_count": 20
    }
  ],
  "top_exporters": [
    {
      "nick_name": "李四",
      "execution_count": 50,
      "web_count": 30,
      "desktop_count": 20
    }
  ],
  "top_searchers": [
    {
      "nick_name": "王五",
      "execution_count": 200,
      "web_count": 150,
      "desktop_count": 50
    }
  ],
  "top_paged": [
    {
      "query_id": "abc123def456...",
      "nick_name": "张三",
      "page_count": 10,
      "platform": "web",
      "type": "sql"
    }
  ],
  "top_analysis": [
    {
      "nick_name": "赵六",
      "execution_count": 30
    }
  ],
  "time_stats": {
    "hourly_distribution": {
      "sql": { "0": 5, "1": 3, "2": 0, ... },
      "es":  { "0": 10, "1": 8, "2": 2, ... }
    }
  }
}
```

- **字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| top_executors | array | SQL 查询执行排行，按 execution_count 降序 |
| top_exporters | array | SQL 导出执行排行 |
| top_searchers | array | ES 查询执行排行 |
| top_paged | array | SQL + ES 合并翻页排行，通过 `type` 字段区分来源 |
| top_analysis | array | ES 用户分析统计（仅 nick_name + execution_count） |
| time_stats | object | 时间分布统计 |
| time_stats.hourly_distribution | object | 按小时分布，key 为 0-23，value 为执行次数 |
| time_stats.hourly_distribution.sql | object | SQL 查询小时分布 |
| time_stats.hourly_distribution.es | object | ES 查询小时分布 |

> **前端兼容层**：前端同时支持新/旧字段名，新结构优先，回退到旧结构：
>
> | 新字段 | 旧字段（回退） |
> |---------|---------------|
> | top_executors | sql_search_stats |
> | top_exporters | sql_export_stats |
> | top_searchers | es_search_stats |
> | top_paged | sql_top_pages + es_page_stats（自动补 type 字段） |
> | top_analysis | es_analysis_stats |
> | time_stats.hourly_distribution.sql | sql_hourly_stats |
> | time_stats.hourly_distribution.es | es_hourly_stats |

- **top_executors / top_exporters / top_searchers 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| nick_name | string | 用户昵称 |
| execution_count | number | 执行总次数 |
| web_count | number | Web 端（浏览器）执行次数 |
| desktop_count | number | 客户端（桌面端）执行次数 |

- **top_paged 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| query_id | string | 查询唯一 ID |
| nick_name | string | 用户昵称 |
| page_count | number | 翻页次数 |
| platform | string | 来源平台：`web`（浏览器）/ `desktop`（客户端） |
| type | string | 查询类型：`sql` / `es` |

---

## 2. SQL 审计 `/audit/sql`

### 2.1 SQL 查询日志列表

- **方法**：POST
- **路径**：`/api/audit/sql/list`
- **请求体**：

```json
{
  "start_time": "2026-06-10 00:00:00",
  "end_time": "2026-06-10 23:59:59",
  "nick_name": "",
  "db_name": "",
  "page": 1,
  "page_size": 20
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_time | string | 否 | 开始时间 |
| end_time | string | 否 | 结束时间 |
| nick_name | string | 否 | 用户昵称过滤 |
| db_name | string | 否 | 数据库名过滤 |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页条数，默认 20 |

### 2.2 SQL 查询详情

- **方法**：POST
- **路径**：`/api/audit/sql/detail`
- **请求体**：

```json
{
  "query_id": "abc123def456..."
}
```

- **响应 `data` 结构**：

```json
{
  "search_detail": {
    "nick_name": "张三",
    "client_ip": "192.168.1.1",
    "city": "北京",
    "region": "北京市",
    "country": "中国",
    "db_name": "test_db",
    "page": 1,
    "Page": 1,
    "query_id": "abc123...",
    "query_sql": "SELECT * FROM users WHERE ...",
    "execution_time": 120,
    "affected_rows": 50,
    "status": "success",
    "created_at": "2026-06-10T10:30:00"
  },
  "page_operations": [
    {
      "Operation": "page",
      "nick_name": "张三",
      "Page": 2,
      "execution_time": 80,
      "affected_rows": 50,
      "status": "success",
      "created_at": "2026-06-10T10:30:05"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| search_detail | object | SQL 查询主记录详情 |
| page_operations | array | 关联的翻页/导出操作记录 |
| Operation | string | 操作类型：`page`（翻页）/ `export`（导出）/ 其他为查询 |

### 2.3 SQL 小时用户统计

- **方法**：POST
- **路径**：`/api/audit/sql/user/stats`
- **请求体**：

```json
{
  "start_time": "2026-06-10 00:00:00",
  "end_time": "2026-06-10 23:59:59",
  "hour": 10
}
```

- **响应 `data` 结构**：

```json
{
  "list": [
    { "id": 1, "user_id": 10, "nick_name": "张三", "count": 25 }
  ]
}
```

### 2.4 SQL 用户小时列表

- **方法**：POST
- **路径**：`/api/audit/sql/user/list`
- **请求体**：与 2.3 相同

---

## 3. ES 审计 `/audit/search`

### 3.1 ES 查询日志列表

- **方法**：POST
- **路径**：`/api/audit/search/list`
- **请求体**：

```json
{
  "start_time": "2026-06-10 00:00:00",
  "end_time": "2026-06-10 23:59:59",
  "nick_name": "",
  "project_name": "",
  "page": 1,
  "page_size": 20
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_time | string | 否 | 开始时间 |
| end_time | string | 否 | 结束时间 |
| nick_name | string | 否 | 用户昵称过滤 |
| project_name | string | 否 | 项目名称过滤 |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页条数，默认 20 |

### 3.2 ES 查询详情

- **方法**：POST
- **路径**：`/api/audit/search/detail`
- **请求体**：

```json
{
  "query_id": "xyz789..."
}
```

- **响应 `data` 结构**：

```json
{
  "search_detail": {
    "nick_name": "王五",
    "client_ip": "10.0.0.5",
    "city": "上海",
    "region": "上海市",
    "country": "中国",
    "project_name": "mhg",
    "view_name": "error_logs",
    "page": 1,
    "q_index_pattern": "app-logs-*",
    "q_time_field": "@timestamp",
    "keyword": "error AND timeout",
    "query_id": "xyz789...",
    "query_time_ms": 350,
    "doc_count": 1200,
    "response_code": 200,
    "search_time": "2026-06-10T14:20:00"
  },
  "page_operations": [
    {
      "operation": "page",
      "nick_name": "王五",
      "page": 2,
      "query_time_ms": 280,
      "doc_count": 1200,
      "created_at": "2026-06-10T14:20:10"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| search_detail | object | ES 查询主记录详情 |
| page_operations | array | 关联的翻页/导出操作记录 |
| operation | string | 操作类型：`page`（翻页）/ `export`（导出）/ 其他为查询 |

### 3.3 ES 小时用户统计

- **方法**：POST
- **路径**：`/api/audit/es/user/stats`
- **请求体**：与 2.3 相同

- **响应 `data` 结构**：

```json
{
  "list": [
    { "id": 1, "user_id": 10, "nick_name": "王五", "count": 45 }
  ]
}
```

### 3.4 ES 用户小时列表

- **方法**：POST
- **路径**：`/api/audit/es/user/list`
- **请求体**：与 2.3 相同

---

## 4. 加解密审计 `/audit/key`

### 4.1 加解密审计日志列表

- **方法**：GET
- **路径**：`/api/audit/key/list`
- **参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_time | string | 否 | 开始时间 |
| end_time | string | 否 | 结束时间 |
| page | int | 否 | 页码 |
| page_size | int | 否 | 每页条数 |

---

## 5. 前端服务层映射

| 前端方法 | HTTP 方法 | 路径 | 说明 |
|---------|-----------|------|------|
| `getAuditAnalysis` | GET | `/audit/analysis` | 审计分析聚合数据 |
| `getSqlLog` | POST | `/audit/sql/list` | SQL 查询日志列表 |
| `getSqlDetail` | POST | `/audit/sql/detail` | SQL 查询详情 |
| `getSqlHourlyUserStats` | POST | `/audit/sql/user/stats` | SQL 小时用户统计 |
| `getSqlUserHourlyList` | POST | `/audit/sql/user/list` | SQL 用户小时列表 |
| `getSearchLog` | POST | `/audit/search/list` | ES 查询日志列表 |
| `getSearchDetail` | POST | `/audit/search/detail` | ES 查询详情 |
| `getEsHourlyUserStats` | POST | `/audit/es/user/stats` | ES 小时用户统计 |
| `getEsUserHourlyList` | POST | `/audit/es/user/list` | ES 用户小时列表 |
| `getKeyAuditLog` | GET | `/audit/key/list` | 加解密审计日志 |

服务层文件：`src/services/audit/audit.ts`
