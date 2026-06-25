# 字典管理接口文档

## 概述

通用字典系统，用于管理各类分类数据。所有字典项存储在同一张表 `sys_dict`，通过 `group_key` 区分不同分组。

**基础路径：** `/api/system/dict`
**认证：** JWT Token
**响应格式：** `{ "code": 200, "message": "xxx", "data": {} }`

---

## 1. 获取字典分组（卡片列表）

- **方法：** GET
- **路径：** `/api/system/dict/groups`
- **说明：** 返回所有字典分组，用于前端卡片展示

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {"group_key": "category", "group_name": "文档分类", "count": 5},
    {"group_key": "view", "group_name": "视图分类", "count": 3},
    {"group_key": "file_category", "group_name": "文件类别", "count": 4}
  ]
}
```

---

## 2. 获取某分组下的字典项

- **方法：** GET
- **路径：** `/api/system/dict/items?group=xxx`
- **参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group | string | 是 | 分组标识（group_key） |

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "group_key": "category",
      "group_name": "文档分类",
      "item_key": "tech",
      "item_value": "技术文档",
      "color": "#1890ff",
      "created_by": "admin",
      "created_at": "2026-04-29T10:00:00Z",
      "updated_at": "2026-04-29T10:00:00Z"
    }
  ]
}
```

---

## 3. 创建字典项

- **方法：** POST
- **路径：** `/api/system/dict/item/create`
- **Content-Type：** application/json

**请求体：**
```json
{
  "group_key": "file_category",
  "group_name": "文件类别",
  "item_key": "sql_export",
  "item_value": "SQL导出",
  "color": "#1890ff"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group_key | string | 是 | 分组标识 |
| group_name | string | 否 | 分组名称（首次创建时填写，后续可不传） |
| item_key | string | 是 | 项标识（同分组下唯一） |
| item_value | string | 是 | 项名称 |
| color | string | 否 | 颜色（#RRGGBB格式） |

**响应示例：**
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 10,
    "group_key": "file_category",
    "group_name": "文件类别",
    "item_key": "sql_export",
    "item_value": "SQL导出",
    "color": "#1890ff",
    "created_by": "admin",
    "created_at": "2026-04-29T10:00:00Z",
    "updated_at": "2026-04-29T10:00:00Z"
  }
}
```

**错误码：**
- 400: 该分组下已存在相同的项

---

## 4. 更新字典项

- **方法：** PUT
- **路径：** `/api/system/dict/item/update`
- **Content-Type：** application/json

**请求体：**
```json
{
  "id": 10,
  "item_value": "SQL导出结果",
  "color": "#52c41a"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int64 | 是 | 字典项ID |
| item_value | string | 否 | 新的项名称 |
| color | string | 否 | 新的颜色 |

**响应示例：**
```json
{
  "code": 200,
  "message": "更新成功",
  "data": null
}
```

**错误码：**
- 404: 字典项不存在

---

## 5. 删除字典项

- **方法：** DELETE
- **路径：** `/api/system/dict/item/delete?id=xxx`
- **参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int64 | 是 | 字典项ID |

**响应示例：**
```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

**错误码：**
- 404: 字典项不存在

---

## 6. 预设分组说明

| group_key | group_name | 用途 |
|-----------|------------|------|
| category | 文档分类 | 知识库文档分类 |
| view | 视图分类 | ES日志视图分类 |
| file_category | 文件类别 | 文件上传分类（映射存储目录） |

---
