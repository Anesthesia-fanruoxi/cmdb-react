/**
 * 加密工具
 * 使用 Rust 端的设备密钥进行 AES-256-GCM 加密
 */

import { invoke } from '@tauri-apps/api/core'

function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 加密数据（使用设备密钥）
 */
export async function encrypt(data: unknown): Promise<string> {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  
  if (!isTauriEnv()) {
    return btoa(encodeURIComponent(text))
  }
  
  return invoke<string>('encrypt_data', { plaintext: text })
}

/**
 * 解密数据（使用设备密钥）
 */
export async function decrypt(encrypted: string): Promise<string> {
  if (!isTauriEnv()) {
    return decodeURIComponent(atob(encrypted))
  }
  
  return invoke<string>('decrypt_data', { encrypted })
}

/**
 * 解密为对象
 */
export async function decryptToObject<T>(encrypted: string): Promise<T | null> {
  try {
    const text = await decrypt(encrypted)
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}
