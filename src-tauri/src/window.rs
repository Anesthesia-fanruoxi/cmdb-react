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

/// 打开小工具独立窗口
/// 如果窗口已存在则直接聚焦，否则创建新窗口
#[tauri::command]
pub async fn open_tool_window(app: AppHandle, tool: String) -> Result<(), String> {
    let label = format!("tool-{}", tool);

    // 窗口已存在 → 直接聚焦
    if let Some(win) = app.get_webview_window(&label) {
        win.show().map_err(|e| e.to_string())?;
        win.unminimize().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // 根据工具类型配置窗口尺寸和标题
    let (title, width, height) = match tool.as_str() {
        "json"     => ("JSON 格式化", 1000.0_f64, 680.0_f64),
        "password" => ("随机密码生成", 480.0_f64, 560.0_f64),
        "case"     => ("驼峰转换", 480.0_f64, 420.0_f64),
        "cron"     => ("Cron 表达式生成", 640.0_f64, 680.0_f64),
        "time"     => ("时间戳转换", 560.0_f64, 480.0_f64),
        _          => ("工具", 520.0_f64, 480.0_f64),
    };

    let url = format!("/detached?type=tool-{}", tool);

    tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::App(url.into()),
    )
    .title(title)
    .inner_size(width, height)
    .min_inner_size(320.0, 240.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
