# 文件管理接口文档

## 概述

文件管理分为两个模块：
- **上传模块** (`/api/file`)：文件上传和下载（核心功能）
- **知识库模块** (`/api/knowledge/file`)：文件列表和删除（运维管理）

---

## 一、上传模块 `/api/file`

### 认证说明

| 接口 | JWT | IP白名单 | 说明 |
|------|-----|----------|------|
| 文件上传 | 不需要 | 需要 | 通过配置文件 `upload.allowed_ips` 验证 |
| 公开文件下载 | 不需要 | 不需要 | 白名单路径，无需token |
| 生成私有下载链接 | 需要 | 不需要 | 需要登录用户 |
| 私有文件下载 | 不需要 | 不需要 | 通过key鉴权 |

---

### 1.1 文件上传

- **方法**：POST
- **路径**：`/api/file/upload`
- **认证**：IP白名单（无需JWT）
- **Content-Type**：`multipart/form-data`

**表单字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | 是 | 文件类别（对应 `sys_dict` 表 `group_key='file'` 的 `item_key`） |
| file | file | 是 | 上传的文件 |
| is_private | string | 否 | `true`=私有文件，默认 `false`=公开 |
| resource | string | 否 | 来源标识，如 `agent`、`bi` |

**存储路径规则：**
```
uploads/
├── public/{item_value}/uuid.ext    # 公开文件
└── private/{item_value}/uuid.ext   # 私有文件
```

> `item_value` 来自字典表，如 category=`sql_export` 对应 item_value=`sqlexport`

**响应示例：**
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "filename": "report.pdf",
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "download_url": "http://example.com/api/file/download/public?uuid=550e8400-e29b-41d4-a716-446655440000",
    "is_private": false,
    "size": 1048576,
    "size_str": "1.00 MB"
  }
}
```

---

### 1.2 公开文件下载

- **方法**：GET
- **路径**：`/api/file/download/public?uuid=xxx`
- **认证**：无需认证（JWT白名单）

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 文件UUID |

**说明：** 仅支持公开文件（`is_private=false`），私有文件会返回 403。

---

### 1.3 生成私有文件下载链接

- **方法**：POST
- **路径**：`/api/file/download/generate`
- **认证**：需要JWT Token
- **Content-Type**：`application/json`

**请求体：**
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "expire": 3600
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 文件UUID |
| expire | int | 否 | 过期时间（秒），默认3600，最大604800（7天） |

**响应示例：**
```json
{
  "code": 200,
  "message": "生成下载链接成功",
  "data": {
    "download_url": "http://example.com/api/file/download/private?key=550e8400-e29b-41d4-a716-446655440000",
    "download_key": "550e8400-e29b-41d4-a716-446655440000",
    "expire_in": 3600,
    "expire_at": "2026-04-29 11:00:00"
  }
}
```

**流程说明：**
1. 用户触发下载申请（如SQL导出审批通过）
2. 调用此接口生成临时下载链接
3. 将链接分享给需要下载的人
4. 链接过期后需重新生成

---

### 1.4 私有文件下载

- **方法**：GET
- **路径**：`/api/file/download/private?key=xxx`
- **认证**：无需认证（JWT白名单，通过key鉴权）

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 下载key（由生成链接接口返回） |

**说明：** key 有效期由生成时指定，过期后无法下载。

---

## 二、知识库模块 `/api/knowledge/file`

> 面向运维人员，用于管理所有上传的文件

### 2.1 公有文件列表

- **方法**：GET
- **路径**：`/api/knowledge/file/public/list`
- **认证**：需要JWT Token

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，从1开始，默认1 |
| page_size | int | 否 | 每页条数，默认20，最大100 |

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 150,
    "list": [
      {
        "filename": "report.pdf",
        "download_url": "http://example.com/api/file/download/public?uuid=550e8400-...",
        "file_size": 1048576,
        "size_str": "1.00 MB",
        "category": "sql_export",
        "resource": "agent",
        "created_at": "2026-04-29 10:00:00"
      }
    ]
  }
}
```

---

### 2.2 私有文件列表

- **方法**：GET
- **路径**：`/api/knowledge/file/private/list`
- **认证**：需要JWT Token

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，从1开始，默认1 |
| page_size | int | 否 | 每页条数，默认20，最大100 |

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 50,
    "list": [
      {
        "filename": "secret_data.xlsx",
        "file_size": 2097152,
        "size_str": "2.00 MB",
        "category": "knowledge",
        "resource": "bi",
        "created_at": "2026-04-29 10:00:00"
      }
    ]
  }
}
```

> **说明：** 私有文件不返回下载链接，需通过 「生成私有下载链接」接口获取临时URL

---

### 2.3 删除文件

- **方法**：DELETE
- **路径**：`/api/knowledge/file/delete?id=1`
- **认证**：需要JWT Token

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int | 是 | 文件记录ID |

**响应示例：**
```json
{
  "code": 200,
  "message": "删除成功"
}
```

---

## 三、使用流程

### 3.1 普通用户（SQL导出等场景）

```
1. 用户发起SQL导出请求
2. 审批流程通过
3. 调用 [生成链接] 接口，传入文件uuid
4. 获得临时下载链接
5. 分享给需要的人
6. 通过链接下载文件
```

### 3.2 运维人员

```
1. 登录系统，进入 知识库 → 文件管理
2. 查看所有文件列表
3. 可为私有文件生成下载链接
4. 可删除不需要的文件
```

---

## 四、IP白名单配置

文件上传接口需要IP白名单验证，配置文件位于 `config/config.yaml`：

```yaml
upload:
  allowed_ips:
    - "127.0.0.1"
    - "192.168.1.0/24"
    - "10.0.0.1"
```

支持精确IP和CIDR格式。
