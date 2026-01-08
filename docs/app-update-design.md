# 应用更新逻辑设计

## 概述

简单的后台静默下载 + 启动时提示安装：
- 使用过程中后台静默下载，不打扰用户
- 下次启动时检测到新版本，弹窗提示用户安装
- 避免重复下载

---

## 实现状态

✅ 已完成：
- `src/services/storage/types.ts` - UpdateInfo 类型定义
- `src/services/storage/appStorage.ts` - 更新信息读写方法
- `src/services/updater.ts` - 后台下载逻辑
- `src/components/UpdateModal/` - 启动时更新弹窗
- `src/App.tsx` - 启动时检查待安装更新
- `src-tauri/src/updater.rs` - Rust 端下载和安装命令

---

## 存储结构

在 `app.dat` 公共存储中的 `update` 字段：

```typescript
interface UpdateInfo {
  latestVersion: string;      // 服务器最新版本号
  downloadedVersion: string;  // 已下载的版本号
  downloadedPath: string;     // 已下载文件的路径
  downloadStatus: 'none' | 'downloading' | 'completed' | 'failed';
  downloadProgress: number;   // 下载进度 0-100
  changelog: string;          // 更新日志
  lastCheckTime: number;      // 最后检查时间戳
}
```

---

## 整体流程

```
┌─────────────────────────────────────────────────────────────┐
│                      程序启动                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
              检查是否有已下载的新版本
              (downloadedVersion > appVersion 
               && downloadStatus === 'completed'
               && 文件存在)
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
              [有新版本]           [无新版本]
                    ↓                   ↓
    ┌───────────────────────┐   ┌───────────────────────┐
    │ 弹窗提示：            │   │ 正常启动              │
    │ "发现新版本 v1.1.0"   │   │ 后台检查更新          │
    │ [立即安装] [稍后]     │   │ 发现新版本则下载      │
    └───────────────────────┘   └───────────────────────┘
              ↓
        用户点击安装
              ↓
    ┌───────────────────────┐
    │ 打开 MSI 安装程序     │
    │ 程序退出              │
    └───────────────────────┘
```

---

## 后台下载逻辑

```typescript
async function backgroundUpdate(): Promise<void> {
  // 1. 检查更新
  const remoteInfo = await fetchLatestVersion();
  if (!remoteInfo) return;
  
  const appVersion = await getAppVersion();
  if (!isNewerVersion(appVersion, remoteInfo.version)) return;
  
  // 2. 判断是否需要下载
  const update = getUpdateInfo();
  if (
    update.downloadedVersion === remoteInfo.version &&
    update.downloadStatus === 'completed' &&
    await fileExists(update.downloadedPath)
  ) {
    console.log('已有最新版本安装包，无需下载');
    return;
  }
  
  // 3. 开始下载
  await saveUpdateInfo({
    latestVersion: remoteInfo.version,
    changelog: remoteInfo.changelog,
    downloadStatus: 'downloading',
    downloadProgress: 0,
    lastCheckTime: Date.now(),
  });
  
  const filePath = await downloadUpdate(remoteInfo);
  
  // 4. 下载完成
  await saveUpdateInfo({
    downloadedVersion: remoteInfo.version,
    downloadedPath: filePath,
    downloadStatus: 'completed',
    downloadProgress: 100,
  });
}
```

---

## 启动时检查

```typescript
async function checkPendingUpdate(): Promise<UpdateInfo | null> {
  const appVersion = await getAppVersion();
  const update = getUpdateInfo();
  
  if (
    update.downloadedVersion &&
    isNewerVersion(appVersion, update.downloadedVersion) &&
    update.downloadStatus === 'completed' &&
    await fileExists(update.downloadedPath)
  ) {
    return update;
  }
  return null;
}
```

---

## 安装流程

用户点击"立即安装"：

```typescript
async function installUpdate(filePath: string): Promise<void> {
  // 打开 MSI 安装程序
  await shell.open(filePath);
  
  // 退出当前程序
  await exit(0);
}
```

---

## UI 弹窗

启动时检测到新版本，显示弹窗：

```
┌─────────────────────────────────────────┐
│                                         │
│         🎉 发现新版本 v1.1.0            │
│                                         │
│  更新内容：                             │
│  1. 新增功能A                           │
│  2. 修复问题B                           │
│                                         │
│     [立即安装]      [稍后提醒]          │
│                                         │
└─────────────────────────────────────────┘
```

---

## 边界情况

1. **下载中断**：重启后检测到 `downloading` 状态，重新下载

2. **文件被删除**：检测文件不存在，重新下载

3. **用户点击稍后**：正常进入程序，下次启动再提示

4. **版本回退**：服务器版本低于已下载版本时，清空下载信息

---

## 实现步骤

1. ✅ 修改 `types.ts` 添加 UpdateInfo 类型
2. ✅ 修改 `appStorage.ts` 添加更新信息读写方法
3. ✅ 重构 `updater.ts` 实现后台下载逻辑
4. ✅ 创建 `UpdateModal` 组件显示更新弹窗
5. ✅ 在 `App.tsx` 启动时检查并显示更新弹窗
6. ✅ Rust 端 `download_update` 和 `install_update` 命令已存在
