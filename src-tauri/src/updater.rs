//! 应用在线更新模块
//! 
//! 功能：
//! - 从自建服务器下载更新包
//! - 静默安装（Windows: MSI, Mac: DMG）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
#[allow(unused_imports)]
use tauri::{AppHandle, Emitter, Manager};
use crate::updater_script;

/// 下载服务器基础地址
const DOWNLOAD_BASE_URL: &str = "https://ops.hzbxhd.com/client";

/// 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub release_date: String,
    pub changelog: String,
}

/// 更新状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UpdateStatus {
    Checking,
    Available { info: VersionInfo },
    NotAvailable,
    Downloading { progress: f64, downloaded: u64, total: u64 },
    Downloaded { path: String },
    Installing,
    Error { message: String },
}

/// 获取当前版本
fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 获取下载目录（使用系统临时目录）
fn get_download_dir() -> PathBuf {
    std::env::temp_dir().join("cmdb-updates")
}

/// 内部生成更新脚本（下载完成时调用）
fn generate_script_internal(msi_path: &str) -> Result<(), String> {
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
    
    let exe_name = "cmdb-desktop.exe";
    
    // 动态获取当前程序路径，如果获取失败则使用默认路径
    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| r"C:\Program Files\CMDB Desktop\cmdb-desktop.exe".to_string());
    
    // 获取 MSI 目录
    let msi_dir = std::path::Path::new(msi_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| download_dir.to_string_lossy().to_string());
    
    let script = updater_script::get_update_script(exe_name, &msi_dir, &exe_path);
    
    let script_path = download_dir.join("cmdb_update.bat");
    // 用 UTF-16 LE with BOM 写入 bat，支持中文路径
    #[cfg(target_os = "windows")]
    write_utf16le(&script_path, &script).map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "windows"))]
    fs::write(&script_path, &script).map_err(|e| e.to_string())?;
    
    println!("[更新] 脚本已生成: {}", script_path.display());
    println!("[更新] 程序路径: {}", exe_path);
    Ok(())
}

/// 检查 MSI 文件是否存在，存在则重新生成脚本
/// 返回 MSI 文件路径（如果存在）
#[tauri::command]
pub fn regenerate_script_if_msi_exists() -> Result<Option<String>, String> {
    let download_dir = get_download_dir();
    
    // 查找 MSI 文件
    let msi_file = fs::read_dir(&download_dir)
        .ok()
        .and_then(|entries| {
            entries
                .filter_map(|e| e.ok())
                .find(|e| e.path().extension().map(|ext| ext == "msi").unwrap_or(false))
                .map(|e| e.path())
        });
    
    match msi_file {
        Some(path) => {
            let path_str = path.to_string_lossy().to_string();
            // 重新生成脚本
            generate_script_internal(&path_str)?;
            println!("[更新] MSI 存在，已重新生成脚本: {}", path_str);
            Ok(Some(path_str))
        }
        None => {
            println!("[更新] MSI 不存在，需要重新下载");
            Ok(None)
        }
    }
}

/// 准备更新（检查 MSI 是否存在，存在则生成脚本，不存在则下载）
/// 前端只需调用这一个命令
#[tauri::command]
pub async fn prepare_update(app: AppHandle, info: VersionInfo) -> Result<String, String> {
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
    
    // 1. 查找已存在的 MSI 文件
    let existing_msi = fs::read_dir(&download_dir)
        .ok()
        .and_then(|entries| {
            entries
                .filter_map(|e| e.ok())
                .find(|e| e.path().extension().map(|ext| ext == "msi").unwrap_or(false))
                .map(|e| e.path())
        });
    
    // 2. 如果 MSI 存在，只生成脚本
    if let Some(msi_path) = existing_msi {
        let path_str = msi_path.to_string_lossy().to_string();
        generate_script_internal(&path_str)?;
        println!("[更新] MSI 已存在，重新生成脚本: {}", path_str);
        return Ok(path_str);
    }
    
    // 3. MSI 不存在，下载新文件
    println!("[更新] MSI 不存在，开始下载...");
    download_update(app, info).await
}

/// 发送更新状态到前端
fn emit_status(app: &AppHandle, status: UpdateStatus) {
    let _ = app.emit("update-status", &status);
}

/// 下载更新（从自建服务器）
#[tauri::command]
pub async fn download_update(app: AppHandle, info: VersionInfo) -> Result<String, String> {
    let (filename, local_filename) = if cfg!(target_os = "windows") {
        ("CMDB-Desktop-windows-x64.msi", format!("cmdb-desktop-{}.msi", info.version))
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            ("CMDB-Desktop-macos-arm64.dmg", format!("cmdb-desktop-{}-arm64.dmg", info.version))
        } else {
            ("CMDB-Desktop-macos-intel.dmg", format!("cmdb-desktop-{}-intel.dmg", info.version))
        }
    } else {
        return Err("不支持的操作系统".to_string());
    };
    
    let download_url = format!("{}/{}", DOWNLOAD_BASE_URL, filename);
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
    let file_path = download_dir.join(&local_filename);
    
    let client = reqwest::Client::new();
    let resp = client.get(&download_url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;
    
    if !resp.status().is_success() {
        return Err(format!("下载失败: {}", resp.status()));
    }
    
    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    
    use futures_util::StreamExt;
    use std::io::Write;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        let progress = if total > 0 { (downloaded as f64 / total as f64) * 100.0 } else { 0.0 };
        emit_status(&app, UpdateStatus::Downloading { progress, downloaded, total });
    }
    
    let path_str = file_path.to_string_lossy().to_string();
    
    // 下载完成后自动生成更新脚本
    if let Err(e) = generate_script_internal(&path_str) {
        eprintln!("生成更新脚本失败: {}", e);
    }
    
    emit_status(&app, UpdateStatus::Downloaded { path: path_str.clone() });
    Ok(path_str)
}

/// 安装更新
#[tauri::command]
pub async fn install_update(app: AppHandle, file_path: String, _install_path: String) -> Result<(), String> {
    emit_status(&app, UpdateStatus::Installing);
    
    #[cfg(target_os = "windows")]
    {
        // 确保脚本存在（重新生成一次）
        generate_script_internal(&file_path)?;
        
        let script_path = get_download_dir().join("cmdb_update.bat");
        
        // 先隐藏窗口，避免退出时出现白框
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
        
        // 等待窗口隐藏完成
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // 使用 VBScript 静默提权运行脚本（避免被安全软件拦截）
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        // 创建 VBS 脚本来静默提权
        // 使用 UTF-16 LE 写入 VBS，确保中文路径不乱码
        let script_path_str = script_path.to_string_lossy().to_string();
        let vbs_content = format!(
            r#"Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "cmd.exe", "/u /c ""{0}""", "", "runas", 0"#,
            script_path_str
        );
        
        let vbs_path = get_download_dir().join("elevate.vbs");
        // 用 UTF-16 LE with BOM 写入，VBScript 原生支持 Unicode，中文路径不乱码
        write_utf16le(&vbs_path, &vbs_content).map_err(|e| e.to_string())?;
        
        println!("[更新] VBS 路径: {}", vbs_path.display());
        println!("[更新] 脚本路径: {}", script_path_str);
        
        let vbs_path_str = vbs_path.to_string_lossy().to_string();
        std::process::Command::new("wscript")
            .arg(&vbs_path_str)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;
        
        // 给脚本一点启动时间，然后退出
        std::thread::sleep(std::time::Duration::from_millis(200));
        app.exit(0);
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS 暂不支持自动重启，只打开安装包
        let _ = _install_path; // 消除未使用警告
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("打开安装包失败: {}", e))?;
        Ok(())
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Err("不支持的操作系统".to_string())
}

/// 获取当前版本号
#[tauri::command]
pub fn get_app_version() -> String {
    get_current_version()
}

/// 获取当前 exe 路径
#[tauri::command]
pub fn get_exe_path() -> Result<String, String> {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// 检查文件是否存在
#[tauri::command]
pub fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// 清理更新下载目录
#[tauri::command]
pub fn clean_update_dir() -> Result<(), String> {
    let download_dir = get_download_dir();
    if download_dir.exists() {
        fs::remove_dir_all(&download_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}


/// 生成更新脚本（用于预览和调试）
/// 注意：此函数现在使用统一的 generate_script_internal
#[tauri::command]
pub fn generate_update_script(msi_path: String, _install_path: String) -> Result<String, String> {
    // 使用统一的脚本生成函数
    generate_script_internal(&msi_path)?;
    
    let script_path = get_download_dir().join("cmdb_update.bat");
    Ok(script_path.to_string_lossy().to_string())
}


/// 读取更新日志（用于调试）
#[tauri::command]
pub fn read_update_log() -> Result<String, String> {
    let log_path = get_download_dir().join("update.log");
    if log_path.exists() {
        fs::read_to_string(&log_path).map_err(|e| e.to_string())
    } else {
        Ok("日志文件不存在".to_string())
    }
}

/// 将字符串以 UTF-16 LE with BOM 写入文件（支持中文路径）
#[cfg(target_os = "windows")]
fn write_utf16le(path: &std::path::Path, content: &str) -> std::io::Result<()> {
    use std::io::Write;
    let mut bytes: Vec<u8> = Vec::new();
    // BOM: FF FE
    bytes.extend_from_slice(&[0xFF, 0xFE]);
    for c in content.encode_utf16() {
        bytes.extend_from_slice(&c.to_le_bytes());
    }
    let mut file = fs::File::create(path)?;
    file.write_all(&bytes)
}

/// 获取更新目录信息（用于调试）
#[tauri::command]
pub fn get_update_dir_info() -> Result<String, String> {
    let download_dir = get_download_dir();
    let mut info = format!("更新目录: {}\n", download_dir.display());
    
    if !download_dir.exists() {
        info.push_str("目录不存在\n");
        return Ok(info);
    }
    
    info.push_str("\n文件列表:\n");
    match fs::read_dir(&download_dir) {
        Ok(entries) => {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                info.push_str(&format!("  - {} ({} bytes)\n", name, size));
            }
        }
        Err(e) => {
            info.push_str(&format!("读取目录失败: {}\n", e));
        }
    }
    
    Ok(info)
}
