/**
 * 系统托盘模块
 * 支持托盘图标、菜单、图标闪烁
 */

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{Menu, MenuItem},
    image::Image,
    Manager, AppHandle, App,
};

// 全局闪烁状态
static FLASHING: AtomicBool = AtomicBool::new(false);

// 创建透明图标 (32x32 RGBA)
fn create_transparent_icon() -> Image<'static> {
    // 32x32 透明图标 (RGBA, 全透明)
    let rgba = vec![0u8; 32 * 32 * 4];
    Image::new_owned(rgba, 32, 32)
}

/// 设置系统托盘
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // 创建托盘菜单
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    
    // 创建托盘图标
    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("CMDB Desktop")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    
    Ok(())
}

/// 开始托盘图标闪烁
#[tauri::command]
pub async fn set_tray_icon_flash(app: AppHandle) -> Result<(), String> {
    if FLASHING.load(Ordering::SeqCst) {
        return Ok(());
    }
    
    FLASHING.store(true, Ordering::SeqCst);
    
    // 在后台线程中执行闪烁
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let transparent_icon = create_transparent_icon();
        let mut visible = true;
        
        while FLASHING.load(Ordering::SeqCst) {
            if let Some(tray) = app_clone.tray_by_id("main") {
                if visible {
                    // 显示正常图标
                    if let Some(icon) = app_clone.default_window_icon() {
                        let _ = tray.set_icon(Some(icon.clone()));
                    }
                } else {
                    // 显示透明图标
                    let _ = tray.set_icon(Some(transparent_icon.clone()));
                }
                visible = !visible;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        
        // 恢复正常图标
        if let Some(tray) = app_clone.tray_by_id("main") {
            if let Some(icon) = app_clone.default_window_icon() {
                let _ = tray.set_icon(Some(icon.clone()));
            }
        }
    });
    
    Ok(())
}

/// 停止托盘图标闪烁
#[tauri::command]
pub async fn stop_tray_icon_flash() -> Result<(), String> {
    FLASHING.store(false, Ordering::SeqCst);
    Ok(())
}
