# 存储重构实现计划

## 一、需要修改的文件

### 1. 存储相关
| 文件 | 修改内容 | 状态 |
|-----|---------|------|
| `src/utils/storage.ts` | 改为兼容层，内部调用新存储服务 | ✅ 完成 |

### 2. Store 相关
| 文件 | 修改内容 | 状态 |
|-----|---------|------|
| `src/stores/authStore.ts` | 适配新存储接口，修改登录/退出逻辑 | ✅ 完成 |
| `src/stores/menuStore.ts` | 移除 persist 中间件，状态由 authStore 恢复 | ✅ 完成 |
| `src/stores/appStore.ts` | 移除 persist 中间件，主题由 authStore 设置 | ✅ 完成 |

### 3. 页面相关
| 文件 | 修改内容 | 状态 |
|-----|---------|------|
| `src/pages/Login/index.tsx` | 添加"保存登录状态"开关，适配新存储 | ✅ 完成 |
| `src/App.tsx` | 修改启动流程，使用新存储服务 | ✅ 完成 |

---

## 二、新增的文件

| 文件 | 说明 | 状态 |
|-----|------|------|
| `src/services/storage/index.ts` | 存储服务入口 | ✅ 完成 |
| `src/services/storage/types.ts` | 类型定义 | ✅ 完成 |
| `src/services/storage/core.ts` | 核心模块（加密/解密/加载/保存） | ✅ 完成 |
| `src/services/storage/appStorage.ts` | app.dat 操作 | ✅ 完成 |
| `src/services/storage/tokenStorage.ts` | tokens.dat 操作 | ✅ 完成 |
| `src/services/storage/profileStorage.ts` | profiles.dat 操作 | ✅ 完成 |
| `src/services/storage/stateStorage.ts` | states.dat 操作 | ✅ 完成 |
| `src/services/storage/preferencesStorage.ts` | preferences.dat 操作 | ✅ 完成 |

注：`credentials.dat` 由 Rust 端管理，`migration.ts` 已移除（不需要数据迁移）

---

## 三、实现进度

### 阶段一：基础存储服务 ✅ 完成
- [x] 步骤 1：创建类型定义
- [x] 步骤 2：创建存储核心
- [x] 步骤 3：创建各存储模块（6个）
- [x] 步骤 4：创建迁移逻辑
- [x] 步骤 5：创建入口文件

### 阶段二：启动流程改造 ✅ 完成
- [x] 步骤 6：App.tsx 使用新存储服务
- [x] 步骤 7：启动时数据加载流程

### 阶段三：Store 适配 ✅ 完成
- [x] 步骤 8：修改 authStore
- [x] 步骤 9：修改 menuStore
- [x] 步骤 10：修改 appStore

### 阶段四：登录页改造 ✅ 完成
- [x] 步骤 11：添加"保存登录状态"开关
- [x] 步骤 12：适配新存储接口

### 阶段五：清理 ✅ 完成
- [x] 步骤 13：旧 storage.ts 改为兼容层

---

## 四、待测试项

1. **登录流程**
   - [ ] 勾选"保存登录状态"登录 → token 写入文件
   - [ ] 不勾选"保存登录状态"登录 → token 仅在内存
   - [ ] 重启应用 → 有 token 自动登录

2. **退出流程**
   - [ ] 退出登录 → 保存状态、删除 token、清除内存
   - [ ] 主题同步到公共存储

3. **状态持久化**
   - [ ] 30 秒自动保存状态
   - [ ] 退出前保存状态
   - [ ] 重启后恢复标签页、侧边栏状态

4. **数据迁移**
   - [ ] 旧 settings.dat 数据正确迁移到新文件

---

## 五、文件结构

```
src/services/storage/
├── types.ts          ← 类型定义
├── core.ts           ← 核心模块
├── appStorage.ts     ← app.dat（公共存储）
├── tokenStorage.ts   ← tokens.dat（单用户 token）
├── profileStorage.ts ← profiles.dat（用户数据）
├── stateStorage.ts   ← states.dat（使用状态）
├── preferencesStorage.ts ← preferences.dat（偏好设置）
└── index.ts          ← 入口导出
```

注：`credentials.dat` 由 Rust 端管理（`src-tauri/src/auth.rs`）

---

## 六、存储文件说明

| 文件 | 用途 | 数据结构 |
|-----|------|---------|
| app.dat | 公共存储 | 登录历史、最后用户、默认主题 |
| tokens.dat | Token 存储 | 单用户 token（可选保存） |
| profiles.dat | 用户数据 | 按用户名存储：用户信息、权限、菜单 |
| states.dat | 使用状态 | 按用户名存储：标签页、路由、侧边栏 |
| preferences.dat | 偏好设置 | 按用户名存储：主题、窗口大小、头像 |
| credentials.dat | 设备凭据 | 按用户名存储：设备绑定密钥 |
