# 插件安装参数说明

## 📋 概述

插件安装接口已按**插件类型**拆分为两个独立接口，前端按业务场景分别调用：

| 插件类型 | 接口路径 | Handler |
|---------|---------|---------|
| 容器 (container) | `POST /api/agent/store/install/container` | `AgentStoreInstallContainer` |
| 二进制 (binary)  | `POST /api/agent/store/install/binary`    | `AgentStoreInstallBinary` |

> 旧接口 `/api/agent/store/install` 已**删除**，请前端切换到对应子路径。

设计目标：
- 请求体字段**完全分离**，杜绝"这个字段该不该传"的歧义
- 后端对插件类型做**双重校验**（路径选择 + DB 查询比对），类型错配时直接 400
- 公共逻辑（鉴权、查插件、调 Agent、过滤敏感字段、组装响应）抽到 `agentStoreInstallCommon.go`

---

## 🔧 接口一：容器类插件安装

### 路径
```
POST /api/agent/store/install/container
权限：agent:store:w
```

> **端口策略**：宿主机映射端口由 **Agent 自行分配**，前端无需传递、后端无需指定。后端只把 DB 中登记好的服务端口（`plugin.Port`，即容器内端口）下发给 Agent。

### 前端请求体 (`ContainerInstallRequest`)
```json
{
  "plugin_id": 1,
  "project": "test-project",
  "config": {
    "DB_HOST": "localhost",
    "DB_PORT": "3306"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `plugin_id` | int64 | ✅ | 插件ID |
| `project` | string | ✅ | 项目标识 |
| `config` | object | ❌ | 环境变量等配置 |

### 后端转发给 Agent 的请求体
```json
{
  "name": "sql-plugs",
  "version": "2.0",
  "category": "container",
  "image": "hub.hzbxhd.com/test/sql-plugs:2.0",
  "download_url": "http://192.168.3.12/plugs/sql-plugs",
  "port": 80,
  "config": { "DB_HOST": "localhost", "DB_PORT": "3306" }
}
```

| 字段 | 来源 | 说明 |
|-----|------|------|
| `image` | 动态拼接 | `{agent.image_url}/{name}:{version}` |
| `download_url` | 动态拼接 | `{agent.download_url}/{name}` |
| `port` | DB `t_plugin_store.port` | 服务端口（容器内端口）；宿主机端口由 Agent 自行分配 |
| `config` | 前端 `config` | 环境变量配置 |

> 若 DB 中 `plugin.port` 未维护（≤0），后端会直接报 500 提示先去插件管理维护。

---

## 🔧 接口二：二进制类插件安装

### 路径
```
POST /api/agent/store/install/binary
权限：agent:store:w
```

> **启动参数策略**：二进制启动配置优先级为 `参数配置 > 环境变量 > 配置文件 > 默认配置`。原本唯一需通过启动参数下发的只有端口，现在端口由 **Agent 自行分配**，所以后端不再下发 `command`；插件可通过环境变量 / 配置文件 / 默认值获得其他启动配置。

### 前端请求体 (`BinaryInstallRequest`)
```json
{
  "plugin_id": 2,
  "project": "test-project",
  "config_content": "[client]\nhost=localhost\nport=3306\n"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `plugin_id` | int64 | ✅ | 插件ID |
| `project` | string | ✅ | 项目标识 |
| `config_content` | string | ❌ | 渲染后的配置文件内容 |

### 后端转发给 Agent 的请求体
```json
{
  "name": "mysql-client",
  "version": "1.0",
  "category": "binary",
  "download_url": "http://192.168.3.12/plugs/mysql-client",
  "config_file": "[client]\nhost=localhost\nport=3306\n"
}
```

| 字段 | 来源 | 说明 |
|-----|------|------|
| `download_url` | 动态拼接 | `{agent.download_url}/{name}` |
| `config_file` | 前端 `config_content` | 渲染后的配置文件内容 |

---

## 📊 参数对比表（发往 Agent）

| 参数 | container | binary | 说明 |
|-----|-----------|--------|------|
| `name` | ✅ | ✅ | 插件名称 |
| `version` | ✅ | ✅ | 版本号 |
| `category` | ✅ | ✅ | 固定值 `container` / `binary` |
| `download_url` | ✅ | ✅ | 所有类型均传递 |
| `image` | ✅ | ❌ | 仅 container |
| `port` | ✅ | ❌ | 仅 container（=DB 服务端口；宿主机端口由 Agent 分配） |
| `config` | ✅ | ❌ | 仅 container |
| `config_file` | ❌ | ✅ | 仅 binary |

---

## 🛡️ 类型错配保护

后端在公共预处理 `prepareInstall` 中对插件类型做强校验：

```go
if plugin.PluginType != expectedType {
    // 返回 400：插件类型不匹配：当前接口仅支持 xxx 类型插件，该插件为 yyy 类型
}
```

举例：
- 把 `binary` 插件的 `plugin_id` 发到 `/install/container` → **400**
- 把 `container` 插件的 `plugin_id` 发到 `/install/binary` → **400**

---

## 🗄️ 数据库字段

### `agent_store` 表结构

```sql
CREATE TABLE `agent_store` (
  `id` bigint PRIMARY KEY COMMENT '主键ID',
  `name` varchar(64) NOT NULL COMMENT '插件名称',
  `version` varchar(32) NOT NULL COMMENT '版本号',
  `display_name` varchar(128) NOT NULL COMMENT '显示名称',
  `plugin_type` varchar(32) NOT NULL COMMENT '插件类型(container/binary)',
  `description` text COMMENT '插件描述',
  `port` int DEFAULT 0 COMMENT '插件服务端口(容器内端口,仅container类型)',
  `created_at` datetime COMMENT '创建时间',
  `updated_at` datetime COMMENT '更新时间'
);
```

**注意：** `config_content` 不存储在数据库，仅在安装时由前端动态传递。

---

## 📝 配置文件

`config/config.yaml`：

```yaml
agent:
  image_url: "hub.hzbxhd.com/test"           # 容器镜像仓库地址
  download_url: "http://192.168.3.12/plugs"  # 下载基础地址
```

- 容器接口安装时若 `image_url` 为空 → 500
- 二进制接口安装时若 `download_url` 为空 → 500

---

## 🔄 完整流程示例

### 容器类型插件安装

**1. 前端请求**
```http
POST /api/agent/store/install/container
Content-Type: application/json

{
  "plugin_id": 1,
  "project": "test-project",
  "config": { "DB_HOST": "localhost" }
}
```

**2. 后端查询 DB**
```json
{ "id": 1, "name": "sql-plugs", "version": "2.0", "plugin_type": "container", "port": 80 }
```

**3. 后端转发给 Agent**
```http
POST {agent_url}/api/plugins/install

{
  "name": "sql-plugs",
  "version": "2.0",
  "category": "container",
  "image": "hub.hzbxhd.com/test/sql-plugs:2.0",
  "download_url": "http://192.168.3.12/plugs/sql-plugs",
  "port": 80,
  "config": { "DB_HOST": "localhost" }
}
```

**4. 成功响应**
```json
{
  "code": 200,
  "message": "安装成功",
  "data": {
    "plugin_name": "sql-plugs",
    "plugin_type": "container",
    "version": "2.0",
    "project": "test-project",
    "service_port": 80,
    "agent_data": { /* 已过滤 config 等敏感字段，宿主机端口可在此查看（取决于 Agent 返回） */ },
    "installed_by": 123
  }
}
```

---

### 二进制类型插件安装

**1. 前端请求**
```http
POST /api/agent/store/install/binary
Content-Type: application/json

{
  "plugin_id": 2,
  "project": "test-project",
  "config_content": "[client]\nhost=localhost\nport=3306\n"
}
```

**2. 后端查询 DB**
```json
{ "id": 2, "name": "mysql-client", "version": "1.0", "plugin_type": "binary" }
```

**3. 后端转发给 Agent**
```http
POST {agent_url}/api/plugins/install

{
  "name": "mysql-client",
  "version": "1.0",
  "category": "binary",
  "download_url": "http://192.168.3.12/plugs/mysql-client",
  "config_file": "[client]\nhost=localhost\nport=3306\n"
}
```

**4. 成功响应**
```json
{
  "code": 200,
  "message": "安装成功",
  "data": {
    "plugin_name": "mysql-client",
    "plugin_type": "binary",
    "version": "1.0",
    "project": "test-project",
    "agent_data": { /* 已过滤 config 等敏感字段 */ },
    "installed_by": 123
  }
}
```

---

## ⚠️ 注意事项

1. **接口二选一**：前端在调用前已知插件类型（来自商店列表的 `plugin_type` 字段），按类型选择对应接口即可。
2. **`download_url` 所有类型都下发**：容器类型可能需要下载附加资源，二进制类型用于下载可执行文件。
3. **宿主机端口由 Agent 分配**：容器接口前端**不再传** `container_port`；后端自动取 DB 中 `plugin.port`（服务端口）下发给 Agent，宿主机映射端口由 Agent 自行决定并在响应中回传。
4. **`plugin.port` 必须维护**：容器插件入库时必须配好服务端口，否则安装时报 500。
5. **`config_content` 可选**：仅由前端动态传入，不持久化；为空时 `omitempty` 不会下发给 Agent。
6. **二进制启动参数交给 Agent 管理**：二进制启动配置优先级为 `参数配置 > 环境变量 > 配置文件 > 默认配置`；原本只需下发端口参数，现端口由 Agent 分配，故后端不再下发 `command`。
7. **敏感字段过滤**：返回给前端的 `agent_data` 中 `config` 字段会被剔除，避免环境变量明文外泄。

---

## 📁 文件结构

```
api/agent/store/
├── agentStoreInstallCommon.go     # 公共：AgentInstallRequest/Response、prepareInstall、callAgentInstall、filterSensitiveData
├── agentStoreInstallContainer.go  # 容器接口：ContainerInstallRequest + AgentStoreInstallContainer
├── agentStoreInstallBinary.go     # 二进制接口：BinaryInstallRequest + AgentStoreInstallBinary
├── agentStoreList.go              # 商店列表
└── storeProjects.go               # 项目列表
```

---

## 🚀 前端迁移指引

| 旧调用 | 新调用 |
|-------|-------|
| `POST /api/agent/store/install` (container) | `POST /api/agent/store/install/container` |
| `POST /api/agent/store/install` (binary)    | `POST /api/agent/store/install/binary` |

请求体差异：
- 容器：**移除 `container_port` 字段**，只保留 `plugin_id` / `project` / `config`（宿主机端口由 Agent 自行分配）
- 二进制：**移除 `command` 字段**，只保留 `plugin_id` / `project` / `config_content`（启动参数交由 Agent 与插件自身的环境变量/配置文件逻辑处理）

无需执行数据库迁移。
