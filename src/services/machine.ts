/**
 * 设备服务
 * 用于获取设备标识、自动登录等
 */

import { invoke } from '@tauri-apps/api/core'

/** 自动登录结果 */
export interface AutoLoginResult {
  success: boolean
  token?: string
  user_id?: string
  user_name?: string
  error?: string
}

/**
 * 检查是否在 Tauri 环境中运行
 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 获取硬件指纹
 */
export async function getHardwareFingerprint(): Promise<string> {
  return invoke<string>('get_hardware_fingerprint')
}

/**
 * 自动登录（Rust 端完成所有逻辑）
 * @param apiBase API 基础地址
 * @param userName 用户名
 * @param version 应用版本号
 */
export async function autoLogin(apiBase: string, userName: string, version: string): Promise<AutoLoginResult> {
  return invoke<AutoLoginResult>('auto_login', { apiBase, userName, version })
}

/**
 * 绑定设备（登录成功后调用，需要双因子验证）
 * @param apiBase API 基础地址
 * @param token 当前登录 token
 * @param userName 用户名
 * @param totpCode 双因子验证码
 * @param version 应用版本号
 */
export async function bindDevice(
  apiBase: string,
  token: string,
  userName: string,
  totpCode: string,
  version: string
): Promise<void> {
  return invoke('bind_device', { apiBase, token, userName, totpCode, version })
}

/**
 * 解绑设备（需要双因子验证）
 * @param apiBase API 基础地址
 * @param token 当前登录 token
 * @param userName 用户名
 * @param totpCode 双因子验证码
 */
export async function unbindDevice(
  apiBase: string,
  token: string,
  userName: string,
  totpCode: string
): Promise<void> {
  return invoke('unbind_device', { apiBase, token, userName, totpCode })
}

/**
 * 清除设备凭证（登出时调用）
 * @param userName 可选，指定用户名则只清除该用户的凭证
 */
export async function clearDeviceCredentials(userName?: string): Promise<void> {
  return invoke('clear_device_credentials', { userName })
}

/**
 * 检查是否有设备凭证
 * @param userName 可选，指定用户名则检查该用户是否有凭证
 */
export async function hasDeviceCredentials(userName?: string): Promise<boolean> {
  return invoke<boolean>('has_device_credentials', { userName })
}

/** 系统信息 */
export interface SystemInfo {
  os_name: string
  os_version: string
  process_memory: number
  storage_size: number
}

/**
 * 获取系统信息
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info')
}
