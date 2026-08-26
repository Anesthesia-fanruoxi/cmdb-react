# SQL 元数据按项目拆分存储

日期：2026-08-26

## 背景

SQL 元数据（数据库、表、字段、注释、统计信息）原本与用户名维度一起保存在 `states/sql-metadata.dat` 单一分片中。元数据体积大（实测约 38MB），每次更新都要对全分片执行 `JSON.stringify` + 加密 + IPC 写入，导致保存阻塞、磁盘占用互相放大。

## 本次改动

### 新增功能

1. **按项目分文件存储**：元数据拆分到 `states/sqlMetadata/` 目录，每个项目一个文件
   - `states/sqlMetadata/index.dat`：索引，记录已缓存的项目列表
   - `states/sqlMetadata/<项目名>.dat`：单项目元数据，整文件覆盖写
2. **去掉用户名维度**：元数据可见性由后端接口权限控制，本地缓存不再区分用户
3. **懒加载**：项目文件不在启动阶段预加载，首次读取时解密加载，命中内存缓存后不重复解密
4. **目录级清除**：「清除缓存」的清除单位是整个 `states/` 目录，`resetStateShards()` 一次清空全部分片及 `states/sqlMetadata/` 子目录（内部按索引枚举清除项目文件）

### 修复 / 兼容

1. **Migration source**: only the top-level `states.dat` is read during startup migration; `states/sql-metadata.dat` is never used.
2. **项目名归一化**：仅保留 `a-zA-Z0-9_-.`，其余字符替换为 `_`，防止路径穿越
3. **索引懒加载保护**：登记/移除索引前先确保索引文件已加载，避免覆盖丢失
4. **顺带修复**：`Header.tsx` 一处字面 `\n` 笔误导致的编译错误

### 未改动

- SQL 补全运行链路（completer → cache 内存读取）完全不受影响，只改了持久化层
- 多 Tab 隔离保持原状
- Rust 端无改动（`save_store_async` 原生支持子目录路径）
- 未实现物理删除文件逻辑（获取失败不删文件，清除缓存走 `store.clear()` 清空内容）

## 关联文件

| 文件 | 改动 |
| --- | --- |
| `src/services/storage/sqlMetadataStorage.ts` | 新增，按项目分文件存储核心（读/写/清除/目录重置） |
| `src/services/storage/types.ts` | `StorageFile` 增加 `states/sqlMetadata/${string}.dat` |
| `src/services/storage/core.ts` | 新增 `ensureStorageFileLoaded` 懒加载；`clearMemoryCache` 清理动态 key |
| `src/services/storage/stateStorage.ts` | 删除旧的 getSqlMetadata/saveSqlMetadata/clearSqlMetadata 及分片写入路径 |
| `src/services/storage/stateShardStorage.ts` | `resetStateShards` 清空整个 states/ 目录（含 sqlMetadata/ 子目录） |
| `src/services/storage/index.ts` | 导出切换到新模块（resetSqlMetadataDir 为内部使用，不对外导出） |
| `src/utils/sql/cache.ts` | 持久化 API 去掉 username 参数，改走新模块 |
| `src/pages/Sql/Search/index.tsx` | 调用点同步简化（8 处） |
| `docs/存储设计.md` | 目录结构、5.5 章节、清除缓存表、体积分析等同步 |

## 效果

- 元数据更新只序列化当前项目文件，38MB 大分片不再被反复全量写入
- 不同项目的元数据互不放大磁盘占用
- 清除缓存一键清空整个 `states/sqlMetadata/` 目录
- 旧用户数据零迁移成本，首次读取自动兼容
