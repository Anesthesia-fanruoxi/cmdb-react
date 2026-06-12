# 项目插件管理接口文档

Base URL: `/api/agent/project`

> 所有接口需携带 JWT Token，请求头：`Authorization: Bearer <token>`

---

## 通用响应格式

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

---

## 1. 获取项目列表

**GET** `/api/agent/project/list`

获取已配置 Agent 的项目列表。

**响应示例：**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "project": "proj-a",
      "project_name": "项目A",
      "agent_url": "http://1.2.3.4:8080",
      "description": "项目描述",
      "has_agent": true
    }
  ]
}
```

---

## 2. 获取项目已安装插件列表

**GET** `/api/agent/project/list/detail?project=xxx`

**Query 参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| project | ✅ | 项目标识 |
| category | ❌ | 按类型过滤：`container` / `binary` |
| status | ❌ | 按状态过滤：`running` / `stopped` |
| name | ❌ | 按名称模糊搜索 |

> 后端会调用 Agent 列表接口，并基于插件商店数据增强返回：
> - 自动追加 `latest_version`、`is_update` 字段（与商店最新版本对比）
> - 对敏感配置字段（password / secret / token / key 等）自动脱敏为 `******`

**响应示例：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 1,
    "agent_version": "1.0.0",
    "eip": "1.2.3.4",
    "plugins": [
      {
        "name": "my-plugin",
        "version": "1.0.0",
        "category": "container",
        "status": "running",
        "host_port": 20001,
        "container_port": 8080,
        "uptime": "2d3h",
        "config": { "DB_HOST": "127.0.0.1", "DB_PASSWORD": "******" },
        "installed_at": "2025-01-01T00:00:00Z",
        "latest_version": "1.2.0",
        "is_update": true
      }
    ]
  }
}
```

> **字段说明：**
> - `host_port`：插件在宿主机上监听的端口
> - `container_port`：仅 container 类型返回，容器内部端口
> - `latest_version`：插件商店中该插件的最新版本，无记录则为 `""`
> - `is_update`：当前版本是否落后于最新版本

---

## 3. 插件控制（启动/停止/重启/卸载）

**POST** `/api/agent/project/control`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | string | ✅ | 项目标识 |
| plugin_name | string | ✅ | 插件名称 |
| action | string | ✅ | 操作类型：`start` / `stop` / `restart` / `uninstall` |

**请求示例：**
```json
{
  "project": "proj-a",
  "plugin_name": "my-plugin",
  "action": "restart"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "restart 成功",
  "data": {
    "project": "proj-a",
    "plugin_name": "my-plugin",
    "action": "restart",
    "agent_data": {
      "name": "my-plugin",
      "action": "restart",
      "result": "操作成功，当前状态: running"
    }
  }
}
```

---

## 4. 插件版本升级

**POST** `/api/agent/project/upgrade`

自动从数据库获取最新版本进行升级，无需前端传版本号。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | string | ✅ | 项目标识 |
| plugin_name | string | ✅ | 插件名称 |

**请求示例：**
```json
{
  "project": "proj-a",
  "plugin_name": "my-plugin"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "upgrade 成功",
  "data": {
    "project": "proj-a",
    "plugin_name": "my-plugin",
    "action": "upgrade",
    "agent_data": {
      "name": "my-plugin",
      "old_version": "1.0.0",
      "new_version": "1.2.0",
      "status": "running",
      "message": "版本升级成功"
    }
  }
}
```

---

## 5. 插件配置更新

**POST** `/api/agent/project/config`

更新插件配置，不影响版本。
- **container 类型**：通过 `config_set` / `config_delete` 增量调整环境变量，重建容器生效
- **binary 类型**：可通过 `config_set` / `config_delete` 增量调整，或直接传入 `config_file_content` 整体覆盖配置文件，重启服务生效

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | string | ✅ | 项目标识 |
| plugin_name | string | ✅ | 插件名称 |
| config_set | object | ❌ | 新增或修改的配置项（upsert） |
| config_delete | array | ❌ | 要删除的配置 key 列表 |
| config_file_content | string | ❌ | 仅 binary：完整配置文件内容（YAML 格式），整体覆盖 |

> `config_set`、`config_delete`、`config_file_content` 三者不能同时为空。

**请求示例（container 同时修改和删除）：**
```json
{
  "project": "proj-a",
  "plugin_name": "my-plugin",
  "config_set": {
    "DB_HOST": "10.0.0.1",
    "DB_PORT": "5432"
  },
  "config_delete": ["OLD_KEY"]
}
```

**请求示例（binary 整文件覆盖）：**
```json
{
  "project": "proj-a",
  "plugin_name": "my-plugin",
  "config_file_content": "server:\n  port: 9090\n  host: 0.0.0.0\ndatabase:\n  host: 10.0.0.1"
}
```

**仅新增/修改：**
```json
{
  "project": "proj-a",
  "plugin_name": "my-plugin",
  "config_set": {
    "NEW_KEY": "value"
  }
}
```

**仅删除：**
```json
{
  "project": "proj-a",
  "plugin_name": "my-plugin",
  "config_delete": ["OLD_KEY", "DEPRECATED_ENV"]
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "config_update 成功",
  "data": {
    "project": "proj-a",
    "plugin_name": "my-plugin",
    "action": "config_update",
    "agent_data": {
      "name": "my-plugin",
      "version": "1.0.0",
      "status": "running",
      "message": "配置更新成功，服务已重启"
    }
  }
}
```

---

## 6. 实时日志（WebSocket）

**WS** `/ws/agent/project/logs?project=xxx&plugin_name=xxx&token=xxx`

**Query 参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| project | ✅ | 项目标识 |
| plugin_name | ✅ | 插件名称 |
| token | ✅ | JWT Token（WebSocket 不支持请求头，通过 query 传递） |

---

## 错误码

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 400 | 参数错误 |
| 401 | 401 | 未授权 / Token 无效 |
| 403 | 403 | 无权限 |
| 404 | 404 | 插件不存在 |
| 405 | 405 | 请求方法不允许 |
| 500 | 500 | 服务内部错误 / Agent 调用失败 |
