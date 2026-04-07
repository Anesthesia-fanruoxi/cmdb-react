//! ELFK 日志导出模块
//! 后端异步下载日志到本地下载目录

use serde::Deserialize;
use std::path::PathBuf;
use tauri::AppHandle;

/// 导出参数
#[derive(Deserialize)]
pub struct ExportParams {
    pub project: String,
    pub index_pattern: String,
    pub start_time: String,
    pub end_time: String,
    pub time_field: String,
    pub keyword: Option<String>,
    pub view_name: Option<String>,
    pub use_field_filter: Option<bool>,
    pub include_fields: Option<Vec<String>>,
}

/// API 响应
#[derive(Deserialize)]
#[allow(dead_code)]
struct ApiResponse {
    code: i32,
    message: Option<String>,
}

/// 获取下载目录
fn get_download_dir() -> Result<PathBuf, String> {
    dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or_else(|| "无法获取下载目录".to_string())
}

/// 生成文件名
fn generate_filename(view_name: &str) -> String {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    format!("{}_{}.xlsx", view_name, timestamp)
}

/// 导出 ELFK 日志
pub async fn export_logs(
    _app_handle: &AppHandle,
    api_base: &str,
    token: &str,
    params: ExportParams,
) -> Result<String, String> {
    let url = format!("{}/elfk/search/export", api_base);
    let client = reqwest::Client::new();
    
    // 构建请求体
    let mut body = serde_json::json!({
        "project": params.project,
        "index_pattern": params.index_pattern,
        "start_time": params.start_time,
        "end_time": params.end_time,
        "time_field": params.time_field,
        "keyword": params.keyword.unwrap_or_default(),
    });
    
    // 添加字段筛选
    if let Some(true) = params.use_field_filter {
        body["use_field_filter"] = serde_json::json!(true);
        if let Some(fields) = &params.include_fields {
            body["include_fields"] = serde_json::json!(fields);
        }
    }
    
    println!("[ELFK] 开始导出: {:?}", body);
    
    // 发送请求
    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    // 检查响应状态
    if !resp.status().is_success() {
        return Err(format!("服务器返回错误: {}", resp.status()));
    }
    
    // 获取响应内容类型
    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    
    // 如果是 JSON，检查是否是成功的任务创建响应
    if content_type.contains("application/json") {
        let result: ApiResponse = resp.json().await
            .map_err(|e| format!("解析响应失败: {}", e))?;
        if result.code == 200 {
            // 后端异步任务模式，返回成功消息
            return Ok(result.message.unwrap_or("导出任务已创建".to_string()));
        }
        return Err(result.message.unwrap_or("导出失败".to_string()));
    }
    
    // 获取文件内容
    let bytes = resp.bytes().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    if bytes.is_empty() {
        return Err("导出数据为空".to_string());
    }
    
    // 保存到下载目录
    let download_dir = get_download_dir()?;
    let view_name = params.view_name.unwrap_or_else(|| "logs".to_string());
    let filename = generate_filename(&view_name);
    let file_path = download_dir.join(&filename);
    
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("保存文件失败: {}", e))?;
    
    println!("[ELFK] 导出成功: {:?}", file_path);
    
    Ok(file_path.to_string_lossy().to_string())
}
