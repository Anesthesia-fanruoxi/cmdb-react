# 本地存储架构设计

## 概述

所有本地数据统一使用 Tauri Store 插件存储，通过 Rust 端设备密钥加密。共 6 个存储文件，按数据类型分类，用户数据以用户名为 key 存储在同一文件中。

## 存储文件结构

```
%APPDATA%/com.cmdb.desktop/
├── app.dat                 # 1. 公共存储（登录历史、默认主题等）
├── tokens.dat              # 2. Token 存储（单用户 token）
├── profiles.dat            # 3. 用户数据（用户信息、权限、菜单）
├── states.dat              # 4. 使用状态（标签页、路由、快照）
├── preferences.dat         # 5. 偏好设置（主题、窗口、头像）
└── credentials.dat         # 6. 设备凭据（Rust 端管理，自动登录凭证）
```

## 各文件数据结构

### 1. `app.dat` - 公共存储

```json
{
  "loginHistory": ["admin", "test", "user1"],
  "lastUser": "admin",
  "defaultTheme": "dark",
  "appVersion": "1.0.0",
  "lastUpdateCheck": 1704067200000,
  "update": {
    "latestVersion": "1.1.0",
    "downloadedVersion": "1.1.0",
    "downloadedPath": "C:/Users/.../cmdb-desktop-1.1.0.msi",
    "downloadStatus": "completed",
    "downloadProgress": 100,
    "changelog": "1. 新增功能A\n2. 修复问题B"
  }
}
```

| 字段 | 类型 | 说明 |
|-----|------|------|
| loginHistory | string[] | 登录过的用户名（最多10个） |
| lastUser | string | 最后登录的用户名 |
| defaultTheme | string | 未登录时的默认主题 |
| appVersion | string | 当前应用版本号 |
| lastUpdateCheck | number | 最后检查更新时间 |
| update | object | 更新信息（见下表） |

**update 字段说明：**

| 字段 | 类型 | 说明 |
|-----|------|------|
| latestVersion | string | 服务器最新版本号 |
| downloadedVersion | string | 已下载的版本号 |
| downloadedPath | string | 已下载文件的本地路径 |
| downloadStatus | string | 下载状态：none / downloading / completed / failed |
| downloadProgress | number | 下载进度 0-100 |
| changelog | string | 更新日志 |

**写入时机：** 登录成功、退出登录、检查更新、下载更新

---

### 2. `tokens.dat` - Token 存储

```json
{
  "token": "eyJhbGc...",
  "username": "admin",
  "expireAt": 1704153600000
}
```

单用户 token 存储，每次只保存一个用户的 token。

| 字段 | 类型 | 说明 |
|-----|------|------|
| token | string | JWT token |
| username | string | token 对应的用户名 |
| expireAt | number | 过期时间戳 |

**写入时机：** 登录成功且用户勾选"保存登录状态"
**清除时机：** 退出登录、token 过期
**特殊说明：** 
- 登录页提供"保存登录状态"开关
- 勾选：token 加密写入文件，下次启动自动登录
- 不勾选：token 仅存内存，关闭软件后失效（支持多开场景）

---

### 3. `profiles.dat` - 用户数据

```json
{
  "admin": {
    "userInfo": { "id": "1", "nick_name": "管理员", "email": "admin@test.com" },
    "permissions": ["system:user:r", "system:role:rw"],
    "menus": [...],
    "roleId": 1,
    "roleName": "超级管理员"
  },
  "test": {
    "userInfo": {...},
    "permissions": [...],
    "menus": [...],
    "roleId": 2,
    "roleName": "普通用户"
  }
}
```

以用户名为 key，存储用户核心业务数据。

**写入时机：** 登录成功、刷新权限、获取用户信息
**清除时机：** 可选（退出登录时清除或保留）

---

### 4. `states.dat` - 使用状态

```json
{
  "admin": {
    "visitedViews": [{ "path": "/dashboard", "title": "首页" }],
    "cachedViews": ["Dashboard"],
    "activeRoute": "/dashboard",
    "sidebarCollapsed": false,
    "lastSnapshot": 1704067200000
  },
  "test": {
    "visitedViews": [...],
    "cachedViews": [...],
    "activeRoute": "/assets",
    "sidebarCollapsed": true,
    "lastSnapshot": 1704067200000
  }
}
```

以用户名为 key，存储使用状态，支持恢复工作现场。

**写入时机：**
- 每 30 秒自动快照
- 窗口关闭前保存
- 退出登录前保存

**读取时机：** 登录成功后恢复状态

---

### 5. `preferences.dat` - 偏好设置

```json
{
  "admin": {
    "avatar": "data:image/png;base64,...",
    "theme": "dark",
    "windowBounds": { "x": 100, "y": 100, "width": 1200, "height": 800 },
    "sidebarWidth": 220
  },
  "test": {
    "avatar": "",
    "theme": "light",
    "windowBounds": { "x": 50, "y": 50, "width": 1400, "height": 900 },
    "sidebarWidth": 200
  }
}
```

以用户名为 key，存储个性化设置，永久保留。

**写入时机：** 用户修改设置时立即保存
**清除时机：** 永不清除（除非用户主动重置）

---

### 6. `credentials.dat` - 设备凭据（Rust 端管理）

```json
{
  "admin": {
    "deviceKey": "encrypted_key_xxx",
    "bindTime": 1704067200000,
    "machineId": "machine_id_xxx"
  }
}
```

以用户名为 key，存储设备绑定信息，用于自动登录。

**由 Rust 端管理**，前端通过 `src/services/machine.ts` 调用：
- `hasDeviceCredentials(username)` - 检查是否有凭据
- `bindDevice(...)` - 绑定设备
- `unbindDevice(...)` - 解绑设备

**兼容性：** 首次启动时会自动将旧文件 `device_credentials.dat` 重命名为 `credentials.dat`

**写入时机：** 设备绑定成功（Rust 端）
**清除时机：** 解绑设备（Rust 端）

---

## 应用启动流程

```
┌─────────────────────────────────────────────────────────────┐
│                      应用启动                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   显示启动页"启动中..."                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  解密 app.dat                                                │
│  - 获取 lastUser（最后登录用户）                             │
│  - 获取 defaultTheme（默认主题）                             │
│  - 设置界面主题                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  检查 tokens.dat 是否存在                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
            [有 token 文件]       [无 token 文件]
                    ↓                   ↓
    ┌───────────────────────┐   ┌───────────────┐
    │ 解密 tokens.dat       │   │ 进入登录页    │
    │ 获取 token + username │   └───────────────┘
    └───────────────────────┘
                    ↓
    ┌───────────────────────┐
    │ 验证 token 有效性     │
    │ GET /api/user/profile │
    └───────────────────────┘
                    ↓
          ┌────────┴────────┐
          ↓                 ↓
      [有效]            [无效]
          ↓                 ↓
    ┌───────────────┐   ┌───────────────┐
    │ 加载用户数据   │   │ 删除 token    │
    │ 恢复状态      │   │ 进入登录页    │
    │ 进入主页      │   └───────────────┘
    └───────────────┘
```

---

## 登录流程

```
用户输入账号密码
    ↓
调用登录接口
    ↓
登录成功，获取 token
    ↓
检查"保存登录状态"开关
    ↓
┌─ 勾选 ────────────────────────┐
│   加密写入 tokens.dat         │
│   下次启动自动登录            │
└───────────────────────────────┘
│
└─ 未勾选 ──────────────────────┐
    │   token 仅存内存          │
    │   关闭软件后失效          │
    │   支持多开不同账号        │
    └───────────────────────────┘
    ↓
更新 app.dat（lastUser、loginHistory）
    ↓
加载用户数据，进入主页
```

---

## 退出登录流程

```
退出登录
    ↓
保存当前用户状态到文件
  - states.dat[username]（标签页、路由等）
  - preferences.dat[username]（主题、窗口大小等）
    ↓
调用服务端登出接口
    ↓
删除 tokens.dat 文件
    ↓
更新 app.dat
  - defaultTheme = 当前用户主题（用于未登录时显示）
    ↓
清空内存状态（store）
    ↓
跳转登录页
```

**说明：**
- 主题会写入两个地方：
  - `preferences.dat[username]` - 该用户的个人偏好
  - `app.dat.defaultTheme` - 未登录时的默认主题

---

## 切换账号流程

```
登录页面选择其他用户名
    ↓
检查 credentials.dat[username] 是否有设备凭据
    ↓
┌─ 有凭据 → 显示"自动登录"按钮
│
└─ 无凭据 → 仅显示手动登录（密码/双因子）
```

**说明：**
- 能进入登录页说明没有有效 token（有 token 会自动登录或已被删除）
- 登录成功前不修改任何文件
- 只需检查目标用户是否有设备凭据来决定显示哪种登录方式

---

## 实现计划

### 第一阶段：基础存储重构
1. 创建新的存储服务 `src/services/storage/`
2. 实现 6 个文件的读写接口
3. 迁移现有数据到新结构

### 第二阶段：启动流程改造
1. 创建启动页组件
2. 实现启动时数据加载逻辑
3. 实现 token 验证和自动登录

### 第三阶段：状态管理集成
1. 改造 authStore
2. 改造 menuStore
3. 实现状态自动保存（30秒快照）

### 第四阶段：偏好设置
1. 实现偏好设置存储
2. 窗口状态保存/恢复
3. 主题同步逻辑

---

## 数据迁移

首次启动新版本时，需要迁移旧数据：

1. 检测旧文件 `settings.dat`、`device_credentials.dat` 是否存在
2. 读取旧数据并解密
3. 按新结构写入对应的 6 个文件
4. 备份并删除旧文件
