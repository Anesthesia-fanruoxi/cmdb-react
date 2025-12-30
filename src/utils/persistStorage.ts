/**
 * Zustand persist 自定义存储适配器
 * 使用设备密钥加密存储，按用户名隔离数据
 */

import { StateStorage } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import { load, Store } from '@tauri-apps/plugin-store'
import { getUserName } from './storage'

const STORE_FILE = 'app-state.dat'
let storeInstance: Store | null = null

function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function getStore(): Promise<Store | null> {
  if (!isTauriEnv()) return null
  if (!storeInstance) {
    storeInstance = await load(STORE_FILE, { defaults: {} })
  }
  return storeInstance
}

async function encryptData(data: string): Promise<string> {
  if (!isTauriEnv()) return btoa(encodeURIComponent(data))
  return invoke<string>('encrypt_data', { plaintext: data })
}

async function decryptData(encrypted: string): Promise<string> {
  if (!isTauriEnv()) {
    try {
      return decodeURIComponent(atob(encrypted))
    } catch {
      return ''
    }
  }
  return invoke<string>('decrypt_data', { encrypted })
}

/**
 * 获取带用户名前缀的存储 key
 * 格式: {userName}:{originalKey}
 * 如果没有用户名，返回 null（不读取/保存）
 */
function getUserKey(name: string): string | null {
  const userName = getUserName()
  if (userName) {
    return `${userName}:${name}`
  }
  // 没有用户名时不操作存储
  return null
}
/**
 * 加密存储适配器（按用户名隔离）
 */
export const encryptedStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const userKey = getUserKey(name)
      if (!userKey) return null
      
      if (isTauriEnv()) {
        const store = await getStore()
        if (!store) return null
        const encrypted = await store.get<string>(userKey)
        if (!encrypted) return null
        return await decryptData(encrypted)
      } else {
        const encrypted = localStorage.getItem(userKey)
        if (!encrypted) return null
        return await decryptData(encrypted)
      }
    } catch (e) {
      console.error(`[Storage] 读取 ${name} 失败:`, e)
      return null
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const userKey = getUserKey(name)
      if (!userKey) return
      
      const encrypted = await encryptData(value)
      if (isTauriEnv()) {
        const store = await getStore()
        if (store) {
          await store.set(userKey, encrypted)
          await store.save()
        }
      } else {
        localStorage.setItem(userKey, encrypted)
      }
    } catch (e) {
      console.error(`[Storage] 保存 ${name} 失败:`, e)
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const userKey = getUserKey(name)
      if (!userKey) return
      
      if (isTauriEnv()) {
        const store = await getStore()
        if (store) {
          await store.delete(userKey)
          await store.save()
        }
      } else {
        localStorage.removeItem(userKey)
      }
    } catch (e) {
      console.error(`删除 ${name} 失败:`, e)
    }
  },
}

/**
 * 清理旧的无前缀存储数据
 */
export async function cleanupLegacyStorage(): Promise<void> {
  const legacyKeys = ['menu-state', 'page-state']
  
  try {
    if (isTauriEnv()) {
      const store = await getStore()
      if (store) {
        for (const key of legacyKeys) {
          const exists = await store.get(key)
          if (exists) {
            await store.delete(key)
          }
        }
        await store.save()
      }
    } else {
      for (const key of legacyKeys) {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
        }
      }
    }
  } catch (e) {
    console.error('[Storage] 清理旧数据失败:', e)
  }
}
