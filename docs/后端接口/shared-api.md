# 共享查询 & 共享关键词接口文档

## 基础说明

- 基础路径：ES `/api/elfk/keyword`，SQL `/api/sql/shared`
- 认证：JWT Token（Header: `Authorization: Bearer xxx`）
- 响应格式：`{ "code": 200, "message": "xxx", "data": {} }`

---

## 1. ES 共享关键词 `/api/elfk/keyword`

### 1.1 创建关键词
- **方法**：POST
- **路径**：`/api/elfk/keyword/create`
- **请求体**：
```json
{
  "project": "项目标识",       // 必填
  "category": "分类",          // 必填
  "view_id": 1,                // 必填，视图ID
  "keyword": "查询语句",       // 必填
  "remark": "备注说明",        // 可选
  "is_shared": true            // 必填，true=共享，false=个人收藏
}
```

### 1.2 查询列表
- **方法**：GET
- **路径**：`/api/elfk/keyword/list`
- **参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | string | 否 | 项目过滤 |
| category | string | 否 | 分类过滤 |
| view_id | string | 否 | 视图ID过滤 |
| is_shared | string | 否 | `0`=个人收藏，`1`=共享记录，空=全部 |
| search | string | 否 | 备注模糊搜索（支持拼音首字母，如 `cs` 匹配"测试"） |
| page | int | 否 | 页码，从1开始，默认1，每页固定100条 |

### 1.3 更新关键词
- **方法**：POST
- **路径**：`/api/elfk/keyword/update`
- **请求体**：
```json
{
  "id": 1,                     // 必填
  "remark": "备注说明",        // 可选
  "is_shared": false           // 可选，true/false切换个人/共享
}
```
- **更新逻辑**：
  - `id` 必传，`remark` 和 `is_shared` 可选
  - 传 `is_shared` 可切换共享状态，不传则保持原值
  - `remark` 更新时，`remark_pinyin` 由后端自动重新生成

### 1.4 删除关键词
- **方法**：DELETE
- **路径**：`/api/elfk/keyword/delete?id=1`

---

## 2. SQL 共享查询 `/api/sql/shared`

### 2.1 创建共享查询
- **方法**：POST
- **路径**：`/api/sql/shared/create`
- **请求体**：
```json
{
  "project": "项目标识",       // 必填
  "db_name": "数据库名",       // 必填
  "query": "SELECT * FROM ...", // 必填
  "remark": "备注说明",        // 可选
  "is_shared": true            // 必填，true=共享，false=个人收藏
}
```
- **保存逻辑**：
  - `creator` 自动填充为当前登录用户
  - `is_shared` 必填，决定记录是否对所有人可见
  - `remark_pinyin` 由后端根据 `remark` 自动生成拼音首字母，前端无需传递

### 2.2 查询列表
- **方法**：GET
- **路径**：`/api/sql/shared/list`
- **参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | string | 否 | 项目过滤 |
| db_name | string | 否 | 数据库过滤 |
| is_shared | string | 否 | `0`=个人收藏，`1`=共享记录，空=全部 |
| search | string | 否 | 备注模糊搜索（支持拼音首字母） |
| page | int | 否 | 页码，从1开始，默认1，每页固定100条 |

### 2.3 更新共享查询
- **方法**：POST
- **路径**：`/api/sql/shared/update`
- **请求体**：
```json
{
  "id": 1,                     // 必填
  "query": "SELECT * FROM ...", // 可选
  "remark": "备注说明",        // 可选
  "is_shared": false           // 可选，true/false切换个人/共享
}
```
- **更新逻辑**：
  - `id` 必传，`query`、`remark`、`is_shared` 可选
  - 传 `is_shared` 可切换共享状态，不传则保持原值
  - `remark` 更新时，`remark_pinyin` 由后端自动重新生成

### 2.4 删除共享查询
- **方法**：DELETE
- **路径**：`/api/sql/shared/delete?id=1`

---

## 3. 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| is_shared | bool | `true`=共享记录（所有人可见），`false`=个人收藏（仅自己可见） |
| remark | string | 备注说明，支持拼音首字母搜索（如搜索 `cs` 可匹配"测试"、"ceshi"） |
| page | int | 分页页码，每页固定返回100条，响应中包含 `total` 用于计算总页数 |

## 4. 响应示例

### 列表响应
```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "list": [
      {
        "id": 1,
        "project": "mhg",
        "category": "manager",
        "view_id": 10,
        "keyword": "error AND timeout",
        "remark": "测试环境错误日志",
        "remark_pinyin": "cshjcwrc",
        "is_shared": true,
        "creator": "zhangsan",
        "created_at": "2026-04-29 10:00:00"
      }
    ],
    "total": 150
  }
}
```
