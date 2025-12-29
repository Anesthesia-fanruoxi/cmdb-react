//! 加密模块
//! AES-256-GCM 加密解密

use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, KeyInit}};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rand::Rng;
use crate::device::get_device_key;

/// 使用设备密钥加密数据
pub fn encrypt(plaintext: &str) -> Result<String, String> {
    let key_bytes = get_device_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    // 生成随机 nonce (12 bytes)
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // 加密
    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;
    
    // 组合 nonce + ciphertext，然后 base64 编码
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);
    Ok(BASE64.encode(&combined))
}

/// 使用设备密钥解密数据
pub fn decrypt(encrypted: &str) -> Result<String, String> {
    let key_bytes = get_device_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    // base64 解码
    let combined = BASE64.decode(encrypted)
        .map_err(|e| format!("Base64解码失败: {}", e))?;
    
    if combined.len() < 12 {
        return Err("加密数据格式错误".to_string());
    }
    
    // 分离 nonce 和 ciphertext
    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];
    
    // 解密
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|_| "解密失败：数据已损坏或密钥不匹配".to_string())?;
    
    String::from_utf8(plaintext)
        .map_err(|e| format!("UTF-8解码失败: {}", e))
}
