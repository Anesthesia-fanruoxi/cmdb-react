# 域名解析管理 API（domainMap）

CMDB 后端域名解析管理模块，前端通过本接口在指定项目（agent）上完成域名解析的全流程自动化操作（阿里云 DNS + nginx 配置 + SSH 重载）。

> **说明**：所有透传接口的实际处理由项目侧 agent 上安装的 `nginx-plugs` 插件完成，CMDB 仅做权限校验、参数透传和响应解密。

---

## 通用约定

### 基础路径

```
/api/assets/domainMap
```

### 鉴权

| 项 | 值 |
|---|---|
| 认证方式 | JWT（Header：`Authorization: Bearer <token>`） |
| 读权限 | `assets:domainMap:r` |
| 写权限 | `assets:domainMap:w` |
| 菜单路径 | `/assets/domainMap` |

### 项目权限

所有写/读接口都会校验当前用户对 `project` 字段是否有 `prod` 环境的访问权。无权访问时返回 `403`。

### 统一响应

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

| 字段 | 说明 |
|---|---|
| `code` | 业务状态码，`200` 表示成功，其它表示失败 |
| `message` | 提示信息 |
| `data` | 业务数据 |

### 通用错误码

| 状态码 | 含义 |
|---|---|
| 400 | 参数错误（必填字段缺失、JSON 解析失败等） |
| 403 | 无权访问该项目 |
| 405 | 请求方法不允许 |
| 500 | 调用 Agent 失败 / 解析 Agent 响应失败 / 服务器内部错误 |

---

## 1. 获取可访问项目列表

返回当前登录用户在 `域名解析管理` 菜单下可访问的项目列表，用于前端项目下拉框。

```
GET /api/assets/domainMap/projects
```

**请求参数**：无

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "project": "bxhd", "project_name": "百姓好店" },
    { "project": "demo", "project_name": "示例项目" }
  ]
}
```

> 实际返回字段以 `utils.GetProjectListByMenuPath` 实现为准。

---

## 2. 获取主域名下拉

获取指定项目下 agent 配置文件 `domains` 配置的可选主域名列表，供前端拼接子域名时使用。

```
GET /api/assets/domainMap/options?project=xxx
```

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `project` | string | 是 | 项目标识 |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "domains": [
      { "name": "hzlsg.com" },
      { "name": "xdysh.com" }
    ]
  }
}
```

---

## 3. 添加域名解析

完整一站式：① 添加阿里云 DNS 记录 → ② 生成 nginx 配置文件 → ③ SSH 远程 reload nginx。

```
POST /api/assets/domainMap/add
Content-Type: application/json
```

**请求体**（二选一）：

方式 A：拼接式（推荐）——前端选择子域名前缀 + 主域名下拉

```json
{
  "project": "bxhd",
  "sub_domain": "testok",
  "domain": "hzlsg.com"
}
```

方式 B：直传完整域名

```json
{
  "project": "bxhd",
  "server_name": "testok.hzlsg.com"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `project` | string | 是 | 项目标识，决定调用哪个 agent |
| `sub_domain` | string | 条件 | 子域名前缀，如 `testok`；与 `server_name` 二选一必填 |
| `domain` | string | 条件 | 主域名（来自 `/options` 下拉），如 `hzlsg.com`；与 `server_name` 二选一必填 |
| `server_name` | string | 条件 | 完整域名；优先级高于 `sub_domain + domain`，与上面二选一必填 |

CMDB 内部最终拼成 `server_name = sub_domain + "." + domain`，调用 `agent /api/nginx/add?server_name=xxx`。

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "server_name": "testok.hzlsg.com",
    "sub_domain": "testok",
    "domain": "hzlsg.com",
    "dns_record_id": "1234567",
    "output_file": "/etc/nginx/cmdb/testok_hzlsg_com.conf",
    "reload_results": [
      { "name": "nginx-01", "host": "192.168.1.10", "status": "success", "error": "" }
    ]
  }
}
```

---

## 4. 预览 nginx 配置

读取已生成的 nginx 配置文件内容（不写入、不重载）。

```
GET /api/assets/domainMap/preview?project=xxx&server_name=testok.hzlsg.com
```

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `project` | string | 是 | 项目标识 |
| `server_name` | string | 是 | 完整域名 |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "server_name": "testok.hzlsg.com",
    "output_file": "/etc/nginx/cmdb/testok_hzlsg_com.conf",
    "content": "server { ... }"
  }
}
```

---

## 5. 已生成配置列表

列出 agent 上 `nginx_conf_dir` 目录中所有由本插件生成的 `.conf` 文件。

```
GET /api/assets/domainMap/list?project=xxx
```

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `project` | string | 是 | 项目标识 |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "files": [
      {
        "domain": "testok.hzlsg.com",
        "path": "/etc/nginx/cmdb/testok_hzlsg_com.conf",
        "created_at": "2026-06-12 10:00:00"
      }
    ],
    "total": 1
  }
}
```

---

## 6. 删除域名解析

完整一站式：① 删除阿里云 DNS 记录 → ② 删除 nginx 配置文件 → ③ SSH 远程 reload nginx。

```
DELETE /api/assets/domainMap/delete?project=xxx&server_name=testok.hzlsg.com
```

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `project` | string | 是 | 项目标识 |
| `server_name` | string | 是 | 完整域名 |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "server_name": "testok.hzlsg.com",
    "filename": "testok_hzlsg_com.conf",
    "dns_deleted": true,
    "reload_results": [
      { "name": "nginx-01", "host": "192.168.1.10", "status": "success", "error": "" }
    ]
  }
}
```

---

## 调用流程示例

典型前端流程：

1. **进入页面** → `GET /projects` 拿项目下拉
2. **选定项目** → `GET /options?project=xxx` 拿主域名下拉
3. **填写子域名前缀 + 选择主域名** → `POST /add` 添加解析
4. **查看已生成配置** → `GET /list?project=xxx`
5. **预览某条配置内容** → `GET /preview?project=xxx&server_name=xxx`
6. **删除某条解析** → `DELETE /delete?project=xxx&server_name=xxx`

---

## 后端实现参考

| 接口 | 处理函数 |
|---|---|
| `/projects` | `domainMap.DomainMapProjects` |
| `/options` | `domainMap.DomainMapOptions` |
| `/add` | `domainMap.DomainMapAdd` |
| `/preview` | `domainMap.DomainMapPreview` |
| `/list` | `domainMap.DomainMapList` |
| `/delete` | `domainMap.DomainMapDelete` |

源码目录：`api/assets/domainMap/`
路由注册：`routers/assets.go`
路径常量：`routers/path/assets.go`

---

## 备注

- agent 端 `nginx-plugs` 插件的实现细节、配置文件格式、模板渲染规则等，参见 `api/assets/domainMap/README.md`
- agent 与 CMDB 之间通信走加密通道（`pkg/middleware/agentClient.go`），插件代理路径前缀为 `/proxy/nginx-plugs`
