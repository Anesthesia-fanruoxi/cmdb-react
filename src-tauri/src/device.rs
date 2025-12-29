//! 设备识别模块
//! 获取机器码、硬件指纹、设备密钥

use sha2::{Sha256, Digest};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 获取机器唯一标识码（基于系统 machine-id）
pub fn get_machine_id() -> Result<String, String> {
    match machine_uid::get() {
        Ok(uid) => {
            let mut hasher = Sha256::new();
            hasher.update(uid.as_bytes());
            Ok(hex::encode(hasher.finalize()))
        }
        Err(e) => Err(format!("获取机器码失败: {}", e))
    }
}

/// 获取硬件指纹（更稳定，基于硬件信息）
pub fn get_hardware_fingerprint() -> Result<String, String> {
    let mut components: Vec<String> = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        // 主板序列号
        if let Ok(output) = Command::new("wmic")
            .args(["baseboard", "get", "serialnumber"])
            .creation_flags(CREATE_NO_WINDOW)
            .output() 
        {
            let s = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = s.lines().nth(1) {
                let serial = line.trim();
                if !serial.is_empty() && serial != "To be filled by O.E.M." {
                    components.push(format!("MB:{}", serial));
                }
            }
        }
        // CPU ID
        if let Ok(output) = Command::new("wmic")
            .args(["cpu", "get", "processorid"])
            .creation_flags(CREATE_NO_WINDOW)
            .output() 
        {
            let s = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = s.lines().nth(1) {
                let cpu_id = line.trim();
                if !cpu_id.is_empty() {
                    components.push(format!("CPU:{}", cpu_id));
                }
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("system_profiler")
            .args(["SPHardwareDataType"])
            .output() 
        {
            let s = String::from_utf8_lossy(&output.stdout);
            for line in s.lines() {
                if line.contains("Hardware UUID") {
                    if let Some(uuid) = line.split(':').nth(1) {
                        components.push(format!("UUID:{}", uuid.trim()));
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = std::fs::read_to_string("/etc/machine-id") {
            components.push(format!("MID:{}", content.trim()));
        }
    }
    
    if components.is_empty() {
        return get_machine_id();
    }
    
    let combined = components.join("|");
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}

/// 生成设备密钥（用于加密本地数据）
pub fn get_device_key() -> Result<Vec<u8>, String> {
    let fingerprint = get_hardware_fingerprint()?;
    let salt = "cmdb-desktop-v1";
    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}", fingerprint, salt).as_bytes());
    Ok(hasher.finalize().to_vec())
}
