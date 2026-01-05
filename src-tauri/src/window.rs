//! 窗口管理模块
//! 
//! 功能：
//! - 任务栏图标高亮（有消息时闪烁）
//! - 窗口主题切换
//! - 窗口置顶

use tauri::{AppHandle, Manager, UserAttentionType, Theme};

/// 请求任务栏注意力（图标高亮/闪烁）
/// Windows: 任务栏图标闪烁
/// macOS: Dock 图标跳动
#[tauri::command]
pub async fn request_attention(app: AppHandle, critical: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let attention_type = if critical {
            Some(UserAttentionType::Critical)
        } else {
            Some(UserAttentionType::Informational)
        };
        window.request_user_attention(attention_type)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 取消任务栏注意力请求
#[tauri::command]
pub async fn cancel_attention(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.request_user_attention(None)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 设置所有窗口主题
#[tauri::command]
pub async fn set_window_theme(app: AppHandle, dark: bool) -> Result<(), String> {
    let theme = if dark { Theme::Dark } else { Theme::Light };
    
    // 设置所有窗口的主题
    for (_, window) in app.webview_windows() {
        let _ = window.set_theme(Some(theme));
    }
    Ok(())
}

/// 将指定窗口带到前台
#[tauri::command]
pub async fn bring_window_to_front(app: AppHandle, label: String) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window(&label) {
        // 显示窗口
        window.show().map_err(|e| e.to_string())?;
        // 取消最小化
        window.unminimize().map_err(|e| e.to_string())?;
        // 获取焦点
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}
