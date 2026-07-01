# 字典管理接口文档

## 概述

通用字典系统，所有字典项存储在 `sys_dict` 表，通过 `group_key` 区分分组。  
分组与字典项接口完全解耦，互不干扰。

**基础路径：** `/api/system/dict`
**认证：** JWT Token
**响应格式：** `{ "code": 200, "message": "xxx", "data": {} }`

---

## 1. 获取字典分组（卡片列表）

- **方法：** GET
- **路径：** `/api/system/dict/groups`

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {"group_key": "file", "group_name": "文件分类", "count": 5}
  ]
}
```

---

## 2. 获取某分组下的字典项

- **方法：** GET
- **路径：** `/api/system/dict/items?group=xxx`

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
      "group_key": "file",
      "group_name": "文件分类",
      "item_key": "es_export",
      "item_name": "日志导出",
      "item_value": "es_export",
      "color": "#1890ff",
      "created_by": "admin",
      "created_at": "2026-06-30T10:00:00+08:00",
      "updated_at": "2026-06-30T10:00:00+08:00"
    }
  ]
}
```

---

## 3. 创建分组

- **方法：** POST
- **路径：** `/api/system/dict/group/create`
- **权限：** `system:dict:w`

**请求体：**
```json
{
  "group_key": "file",
  "group_name": "文件分类"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group_key | string | 是 | 分组标识（全局唯一） |
| group_name | string | 是 | 分组中文名称 |

**错误：** 400 - 该分组已存在

---

## 4. 删除分组

- **方法：** DELETE
- **路径：** `/api/system/dict/group/delete?group_key=xxx`
- **权限：** `system:dict:w`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group_key | string | 是 | 分组标识（会删除该分组下所有字典项） |

**错误：** 404 - 分组不存在

---

## 5. 创建字典项

- **方法：** POST
- **路径：** `/api/system/dict/item/create`
- **权限：** `system:dict:w`
- **前置条件：** 分组必须已存在

**请求体：**
```json
{
  "group_key": "file",
  "item_key": "es_export",
  "item_name": "日志导出",
  "item_value": "es_export",
  "color": "#1890ff"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group_key | string | 是 | 所属分组标识（必须已存在） |
| item_key | string | 是 | 项标识（同分组下唯一） |
| item_name | string | 否 | 项中文名称 |
| item_value | string | 是 | 项值 |
| color | string | 否 | 颜色（#RRGGBB） |

**错误：** 400 - 分组不存在 / 同分组下已存在相同项

---

## 6. 更新字典项

- **方法：** PUT
- **路径：** `/api/system/dict/item/update`
- **权限：** `system:dict:w`

**请求体：**
```json
{
  "id": 1,
  "item_name": "日志导出（新）",
  "item_value": "es_export_v2",
  "color": "#ff4d4f"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int64 | 是 | 字典项ID |
| item_name | string | 否 | 项名称 |
| item_value | string | 否 | 项值 |
| color | string | 否 | 颜色（#RRGGBB） |

---

## 7. 删除字典项

- **方法：** DELETE
- **路径：** `/api/system/dict/item/delete?id=xxx`
- **权限：** `system:dict:w`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int64 | 是 | 字典项ID |

---

## 字段说明

| 字段 | 说明 |
|------|------|
| group_key | 分组标识，全局唯一 |
| group_name | 分组中文名称 |
| item_key | 项的唯一标识（代码中使用） |
| item_name | 项的中文名称（展示用） |
| item_value | 项的值（如目录名、枚举值） |
| color | 前端标签颜色 |

---

## 数据库变更

```sql
ALTER TABLE sys_dict ADD COLUMN item_name VARCHAR(64) DEFAULT '' COMMENT '项名称' AFTER item_key;
```
