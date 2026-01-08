# 应用更新逻辑设计

## 概述

后台静默下载 + 启动时提示安装 + 定时清理：
- 启动时检查更新，有新版本则下载并弹窗提示
- 用户确认后静默安装并重启
- 后台每5分钟检查一次，无更新时自动清理临时文件

---

## 文件说明

| 文件 | 路径 | 说明 |
|------|------|------|
| MSI 安装包 | `%TEMP%\cmdb-updates\cmdb-desktop-{version}.msi` | 下载的安装包 |
| 更新脚本 | `%TEMP%\cmdb-updates\cmdb_update.bat` | 安装脚本 |
| 提权脚本 | `%TEMP%\cmdb-updates\elevate.vbs` | UAC 提权脚本 |
| 更新记录 | `app.dat` 中的 `update` 字段 | 记录下载状态 |

---

## 存储结构

在 `app.dat` 公共存储中的 `update` 字段：

```typescript
interface UpdateInfo {
  latestVersion: string;      // 服务器最新版本号
  downloadedVersion: string;  // 已下载的版本号
  downloadedPath: string;     // 已下载 MSI 文件的路径
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
                              │
                              ↓
                    [后端] 启动定时检查线程
                              │
                              ↓
                    每5分钟检查版本接口
                              │
              ┌───────────────┴───────────────┐
              ↓                               ↓
         [有新版本]                       [无更新]
              ↓                               ↓
         下载 MSI                        清理临时目录
         生成脚本
              ↓
    推送 update-available 事件给前端
              ↓
    [前端] 收到事件，展示更新弹窗
              ↓
    用户点击"立即安装"
              ↓
    [前端] 调用 install_update 命令
              ↓
    [后端] 执行安装脚本
```

---

## 安装流程

```
用户点击"立即安装"
        ↓
  [前端] 关闭弹窗，调用 install_update
        ↓
  [后端] 生成更新脚本
        ↓
  [后端] 创建 VBS 提权脚本
        ↓
  [后端] 隐藏主窗口
        ↓
  [后端] 通过 wscript 执行 VBS（弹出 UAC 确认）
        ↓
  [后端] 退出程序
        ↓
  [脚本] 以管理员身份静默运行
        ↓
  [脚本] 强制关闭进程
        ↓
  [脚本] 卸载旧版本
        ↓
  [脚本] 安装新版本
        ↓
  [脚本] 启动新程序
```

---

## 定时检查（后端）

```rust
// updater_checker.rs
// 每5分钟执行一次
loop {
    sleep(5 * 60);
    
    // 1. 检查版本接口
    let remote_version = fetch_version_api();
    
    if is_newer_version(current, remote_version) {
        // 2. 下载 MSI
        let msi_path = download_msi(version);
        
        // 3. 生成安装脚本
        generate_script(msi_path);
        
        // 4. 推送给前端
        app.emit("update-available", UpdateNotification {
            version,
            changelog,
            msi_path,
        });
    } else {
        // 无更新，清理目录
        clean_download_dir();
    }
}
```

前端监听 `update-available` 事件：

```typescript
listen('update-available', (event) => {
  const { version, changelog, msi_path } = event.payload;
  // 显示更新弹窗
  showUpdateModal(version, changelog, msi_path);
});
```

---

## 脚本内容

```batch
@echo off
:: 已以管理员身份运行（通过 VBS 提权）

:: 1. 强制关闭进程
taskkill /F /IM cmdb-desktop.exe

:: 2. 查找 MSI 文件
for %%f in ("%MSI_DIR%\*.msi") do set "MSI_FILE=%%f"

:: 3. 卸载旧版本
msiexec /x "%MSI_FILE%" /quiet /norestart

:: 4. 安装新版本
msiexec /i "%MSI_FILE%" /quiet /norestart

:: 5. 启动程序
start "" "C:\Program Files\CMDB Desktop\cmdb-desktop.exe"
```

---

## 实现文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/updater.rs` | 下载、安装命令 |
| `src-tauri/src/updater_script.rs` | 脚本模板 |
| `src-tauri/src/updater_checker.rs` | 定时检查和清理 |
| `src/services/updater.ts` | 前端更新逻辑 |
| `src/components/UpdateModal/` | 更新弹窗组件 |
| `src/App.tsx` | 启动时检查逻辑 |

---

## 提权方式

使用 VBScript 进行 UAC 提权（避免被安全软件拦截）：

```vbscript
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "cmd", "/c ""脚本路径""", "", "runas", 0
```

- `runas`: 请求管理员权限
- `0`: 隐藏窗口

---

## 边界情况

| 情况 | 处理方式 |
|------|---------|
| 下载中断 | 重启后检测到 `downloading` 状态，重新下载 |
| MSI 被删除 | 检测文件不存在，重新下载 |
| 用户点击稍后 | 正常进入程序，下次启动再提示 |
| 版本已安装 | 清空下载记录和临时文件 |
| 无更新 | 定时检查时自动清理临时目录 |
| UAC 被拒绝 | 安装失败，用户需重新点击安装 |
