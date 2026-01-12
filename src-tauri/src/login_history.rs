//! 登录历史管理模块
//! 存储和管理用户登录历史记录

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const HISTORY_FILE: &str = "login_history.json";
const MAX_HISTORY: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoginHistory {
    pub history: Vec<String>,
    pub last_user: String,
}

/// 获取历史文件路径
fn get_history_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {}", e))?;
    
    // 确保目录存在
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    Ok(app_dir.join(HISTORY_FILE))
}

/// 加载登录历史
pub fn load_history(app_handle: &AppHandle) -> LoginHistory {
    let path = match get_history_path(app_handle) {
        Ok(p) => p,
        Err(_) => return LoginHistory::default(),
    };
    
    if !path.exists() {
        return LoginHistory::default();
    }
    
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => LoginHistory::default(),
    }
}

/// 保存登录历史
fn save_history(app_handle: &AppHandle, history: &LoginHistory) -> Result<(), String> {
    let path = get_history_path(app_handle)?;
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

/// 添加登录历史
pub fn add_history(app_handle: &AppHandle, username: &str) -> Result<(), String> {
    let mut data = load_history(app_handle);
    
    // 移除已存在的相同用户名
    data.history.retain(|u| u != username);
    
    // 添加到开头
    data.history.insert(0, username.to_string());
    
    // 限制数量
    data.history.truncate(MAX_HISTORY);
    
    // 更新最后用户
    data.last_user = username.to_string();
    
    save_history(app_handle, &data)
}

/// 获取登录历史列表
pub fn get_history(app_handle: &AppHandle) -> Vec<String> {
    load_history(app_handle).history
}

/// 获取最后登录用户
pub fn get_last_user(app_handle: &AppHandle) -> String {
    load_history(app_handle).last_user
}

/// 清除登录历史
pub fn clear_history(app_handle: &AppHandle) -> Result<(), String> {
    save_history(app_handle, &LoginHistory::default())
}
