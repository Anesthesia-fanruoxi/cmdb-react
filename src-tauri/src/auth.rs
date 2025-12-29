//! 认证模块
//! 设备绑定、自动登录（挑战-响应机制）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use crate::device::get_hardware_fingerprint;
use crate::crypto::{encrypt, decrypt};

const CREDENTIALS_FILE: &str = "device_credentials.dat";

type HmacSha256 = Hmac<Sha256>;

/// 设备凭证（本地加密存储）
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceCredentials {
    pub user_name: String,
    pub machine_id: String,
    pub device_secret: String,
}

/// 多用户凭证存储
#[derive(Serialize, Deserialize, Default)]
pub struct CredentialsStore {
    /// 用户名 -> 凭证
    pub credentials: std::collections::HashMap<String, DeviceCredentials>,
}

/// 挑战码响应
#[derive(Deserialize)]
pub struct ChallengeResponse {
    pub code: i32,
    pub message: Option<String>,
    pub data: Option<ChallengeData>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ChallengeData {
    pub challenge: String,
    pub expires_at: i64,
}

/// 登录响应
#[derive(Deserialize)]
pub struct LoginResponse {
    pub code: i32,
    pub message: Option<String>,
    pub data: Option<LoginData>,
}

#[derive(Deserialize)]
pub struct LoginData {
    pub token: String,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
}

/// 绑定设备响应
#[derive(Deserialize)]
pub struct BindResponse {
    pub code: i32,
    pub message: Option<String>,
    pub data: Option<BindData>,
}

#[derive(Deserialize)]
pub struct BindData {
    pub device_secret: String,
}

/// 自动登录结果
#[derive(Serialize)]
pub struct AutoLoginResult {
    pub success: bool,
    pub token: Option<String>,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
    pub error: Option<String>,
}

/// 获取凭证文件路径
fn get_credentials_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {}", e))?;
    
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    
    Ok(app_dir.join(CREDENTIALS_FILE))
}

/// 保存设备凭证（加密存储，支持多用户）
pub fn save_credentials(
    app_handle: &tauri::AppHandle,
    credentials: &DeviceCredentials
) -> Result<(), String> {
    let path = get_credentials_path(app_handle)?;
    println!("[Auth] 保存凭证到: {:?}", path);
    
    // 读取现有凭证
    let mut store = load_credentials_store(app_handle).unwrap_or_default();
    
    // 添加或更新该用户的凭证
    store.credentials.insert(credentials.user_name.clone(), credentials.clone());
    println!("[Auth] 保存用户 {} 的凭证", credentials.user_name);
    
    let json = serde_json::to_string(&store)
        .map_err(|e| format!("序列化失败: {}", e))?;
    
    let encrypted = encrypt(&json)?;
    
    fs::write(&path, encrypted)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    
    println!("[Auth] 凭证保存成功");
    Ok(())
}

/// 读取凭证存储
fn load_credentials_store(app_handle: &tauri::AppHandle) -> Result<CredentialsStore, String> {
    let path = get_credentials_path(app_handle)?;
    println!("[Auth] 读取凭证文件: {:?}", path);
    
    if !path.exists() {
        println!("[Auth] 凭证文件不存在");
        return Err("凭证文件不存在".to_string());
    }
    
    let encrypted = fs::read_to_string(&path)
        .map_err(|e| {
            println!("[Auth] 读取文件失败: {}", e);
            format!("读取文件失败: {}", e)
        })?;
    
    println!("[Auth] 读取到加密数据，长度: {}", encrypted.len());
    
    let json = decrypt(&encrypted).map_err(|e| {
        println!("[Auth] 解密失败: {}", e);
        e
    })?;
    
    println!("[Auth] 解密成功，JSON长度: {}", json.len());
    
    // 尝试解析为新格式
    if let Ok(store) = serde_json::from_str::<CredentialsStore>(&json) {
        println!("[Auth] 解析为新格式成功");
        return Ok(store);
    }
    
    // 兼容旧格式（单用户）
    if let Ok(old_cred) = serde_json::from_str::<DeviceCredentials>(&json) {
        println!("[Auth] 解析为旧格式成功，迁移中...");
        let mut store = CredentialsStore::default();
        store.credentials.insert(old_cred.user_name.clone(), old_cred);
        return Ok(store);
    }
    
    println!("[Auth] 解析凭证失败");
    Err("解析凭证失败".to_string())
}

/// 读取指定用户的设备凭证
pub fn load_credentials(app_handle: &tauri::AppHandle) -> Result<DeviceCredentials, String> {
    let store = load_credentials_store(app_handle)?;
    
    // 返回第一个凭证（兼容旧逻辑）
    store.credentials.values().next().cloned()
        .ok_or("没有凭证".to_string())
}

/// 读取指定用户名的设备凭证
pub fn load_credentials_by_user(
    app_handle: &tauri::AppHandle,
    user_name: &str
) -> Result<DeviceCredentials, String> {
    println!("[Auth] 读取用户 {} 的凭证", user_name);
    let store = load_credentials_store(app_handle)?;
    println!("[Auth] 凭证存储中有 {} 个用户", store.credentials.len());
    for key in store.credentials.keys() {
        println!("[Auth] - 用户: {}", key);
    }
    
    store.credentials.get(user_name).cloned()
        .ok_or(format!("用户 {} 没有绑定设备", user_name))
}

/// 检查指定用户是否有设备凭证
pub fn has_credentials_for_user(app_handle: &tauri::AppHandle, user_name: &str) -> bool {
    println!("[Auth] 检查用户 {} 是否有凭证", user_name);
    let result = load_credentials_by_user(app_handle, user_name).is_ok();
    println!("[Auth] 检查结果: {}", result);
    result
}

/// 删除设备凭证（删除所有用户的凭证）
pub fn remove_credentials(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let path = get_credentials_path(app_handle)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("删除文件失败: {}", e))?;
    }
    Ok(())
}

/// 删除指定用户的设备凭证
pub fn remove_credentials_for_user(
    app_handle: &tauri::AppHandle,
    user_name: &str
) -> Result<(), String> {
    let path = get_credentials_path(app_handle)?;
    let mut store = load_credentials_store(app_handle).unwrap_or_default();
    
    store.credentials.remove(user_name);
    
    if store.credentials.is_empty() {
        // 没有凭证了，删除文件
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("删除文件失败: {}", e))?;
        }
    } else {
        // 保存剩余凭证
        let json = serde_json::to_string(&store)
            .map_err(|e| format!("序列化失败: {}", e))?;
        let encrypted = encrypt(&json)?;
        fs::write(&path, encrypted)
            .map_err(|e| format!("写入文件失败: {}", e))?;
    }
    
    Ok(())
}

/// 生成 HMAC-SHA256 签名
fn generate_signature(challenge: &str, timestamp: i64, device_secret: &str) -> String {
    let message = format!("{}:{}", challenge, timestamp);
    let mut mac = HmacSha256::new_from_slice(device_secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(message.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// 绑定设备（登录成功后调用，需要双因子验证）
pub async fn bind_device(
    app_handle: &tauri::AppHandle,
    api_base: &str,
    token: &str,
    user_name: &str,
    totp_code: &str,
    version: &str,
) -> Result<(), String> {
    let machine_id = get_hardware_fingerprint()?;
    let url = format!("{}/system/user/device/bind", api_base);
    
    let client = reqwest::Client::new();
    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "machine_id": machine_id,
            "totp_code": totp_code,
            "version": version
        }))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let result: BindResponse = resp.json().await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    if result.code != 200 {
        return Err(result.message.unwrap_or("绑定失败".to_string()));
    }
    
    let data = result.data.ok_or("响应数据为空")?;
    
    // user_name 从前端传入，用于本地存储凭证
    let credentials = DeviceCredentials {
        user_name: user_name.to_string(),
        machine_id,
        device_secret: data.device_secret,
    };
    
    save_credentials(app_handle, &credentials)?;
    Ok(())
}

/// 解绑响应
#[derive(Deserialize)]
pub struct UnbindResponse {
    pub code: i32,
    pub message: Option<String>,
}

/// 解绑设备（需要双因子验证）
pub async fn unbind_device(
    app_handle: &tauri::AppHandle,
    api_base: &str,
    token: &str,
    user_name: &str,
    totp_code: &str,
) -> Result<(), String> {
    let url = format!("{}/system/user/device/unbind", api_base);
    
    let client = reqwest::Client::new();
    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "totp_code": totp_code
        }))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let result: UnbindResponse = resp.json().await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    if result.code != 200 {
        return Err(result.message.unwrap_or("解绑失败".to_string()));
    }
    
    // 删除本地凭证
    remove_credentials_for_user(app_handle, user_name)?;
    println!("[Auth] 设备解绑成功，已清除本地凭证");
    Ok(())
}


/// 请求挑战码
async fn request_challenge(
    api_base: &str,
    user_name: &str,
    machine_id: &str,
) -> Result<ChallengeData, String> {
    let url = format!("{}/system/user/device/challenge", api_base);
    let client = reqwest::Client::new();
    
    let resp = client.post(&url)
        .json(&serde_json::json!({
            "user_name": user_name,
            "machine_id": machine_id
        }))
        .send()
        .await
        .map_err(|e| format!("请求挑战码失败: {}", e))?;
    
    let result: ChallengeResponse = resp.json().await
        .map_err(|e| format!("解析挑战码响应失败: {}", e))?;
    
    if result.code != 200 {
        return Err(result.message.unwrap_or("获取挑战码失败".to_string()));
    }
    
    result.data.ok_or("挑战码数据为空".to_string())
}

/// 自动登录（挑战-响应机制）
pub async fn auto_login(
    app_handle: &tauri::AppHandle,
    api_base: &str,
    user_name: &str,
    version: &str,
) -> AutoLoginResult {
    // 1. 读取指定用户的本地凭证
    let credentials = match load_credentials_by_user(app_handle, user_name) {
        Ok(c) => c,
        Err(e) => return AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: Some(e),
        },
    };
    
    // 2. 验证 machine_id 是否匹配当前设备
    let current_machine_id = match get_hardware_fingerprint() {
        Ok(id) => id,
        Err(e) => return AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: Some(e),
        },
    };
    
    if credentials.machine_id != current_machine_id {
        let _ = remove_credentials(app_handle);
        return AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: Some("设备不匹配".to_string()),
        };
    }
    
    // 3. 请求挑战码
    let challenge_data = match request_challenge(
        api_base,
        &credentials.user_name,
        &credentials.machine_id
    ).await {
        Ok(c) => c,
        Err(e) => {
            // 只有凭据过期或设备未绑定才清除本地凭证
            if e.contains("过期") || e.contains("expired") || e.contains("未绑定") || e.contains("not bound") {
                let _ = remove_credentials_for_user(app_handle, user_name);
            }
            return AutoLoginResult {
                success: false,
                token: None,
                user_id: None,
                user_name: None,
                error: Some(e),
            };
        }
    };
    
    // 4. 生成签名
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    let signature = generate_signature(
        &challenge_data.challenge,
        timestamp,
        &credentials.device_secret
    );
    
    // 5. 发送登录请求
    let url = format!("{}/system/user/device/login", api_base);
    let client = reqwest::Client::new();
    
    let resp = match client.post(&url)
        .json(&serde_json::json!({
            "user_name": credentials.user_name,
            "machine_id": credentials.machine_id,
            "challenge": challenge_data.challenge,
            "timestamp": timestamp,
            "signature": signature,
            "version": version
        }))
        .send()
        .await 
    {
        Ok(r) => r,
        Err(e) => return AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: Some(format!("请求失败: {}", e)),
        },
    };
    
    let result: LoginResponse = match resp.json().await {
        Ok(r) => r,
        Err(e) => return AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: Some(format!("解析响应失败: {}", e)),
        },
    };
    
    if result.code != 200 {
        // 只有凭据过期才清除本地凭证（版本过低等情况不删除）
        if let Some(ref msg) = result.message {
            if msg.contains("过期") || msg.contains("expired") {
                let _ = remove_credentials_for_user(app_handle, user_name);
            }
        }
        return AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: result.message,
        };
    }
    
    match result.data {
        Some(data) => AutoLoginResult {
            success: true,
            token: Some(data.token),
            user_id: data.user_id,
            user_name: data.user_name,
            error: None,
        },
        None => AutoLoginResult {
            success: false,
            token: None,
            user_id: None,
            user_name: None,
            error: Some("响应数据为空".to_string()),
        },
    }
}
