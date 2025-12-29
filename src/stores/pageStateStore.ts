/**
 * 页面状态管理（快照功能）
 * 保存各页面的表单状态，支持恢复
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { encryptedStorage } from '../utils/persistStorage'

/** 页面状态数据 */
interface PageState {
  scrollTop?: number
  formData?: Record<string, unknown>
  [key: string]: unknown
}

/** SQL 页面状态 */
interface SqlPageState extends PageState {
  sqlContent?: string
  selectedDb?: string
  selectedTable?: string
}

/** 所有页面状态 */
interface PageStates {
  // SQL 相关页面
  'sql/query'?: SqlPageState
  'sql/apply'?: SqlPageState
  // 其他页面可以继续添加
  [pageKey: string]: PageState | undefined
}

interface PageStateStore {
  // 状态
  pages: PageStates
  lastRoute: string | null
  lastSaveTime: number | null
  _hasHydrated: boolean

  // 操作
  setPageState: <T extends PageState>(pageKey: string, state: Partial<T>) => void
  getPageState: <T extends PageState>(pageKey: string) => T | undefined
  clearPageState: (pageKey: string) => void
  clearAllPageStates: () => void
  setLastRoute: (route: string) => void
  setHasHydrated: (state: boolean) => void
  rehydrate: () => Promise<void>
}

export const usePageStateStore = create<PageStateStore>()(
  persist(
    (set, get) => ({
      pages: {},
      lastRoute: null,
      lastSaveTime: null,
      _hasHydrated: false,

      // 设置页面状态（合并更新）
      setPageState: (pageKey, state) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pageKey]: {
              ...prev.pages[pageKey],
              ...state,
            },
          },
          lastSaveTime: Date.now(),
        }))
      },

      // 获取页面状态
      getPageState: <T extends PageState>(pageKey: string) => {
        return get().pages[pageKey] as T | undefined
      },

      // 清除单个页面状态
      clearPageState: (pageKey) => {
        set((prev) => {
          const { [pageKey]: _, ...rest } = prev.pages
          return { pages: rest }
        })
      },

      // 清除所有页面状态（保留 hydration 状态）
      clearAllPageStates: () => {
        set({ pages: {}, lastRoute: null, lastSaveTime: null })
      },

      // 设置最后访问的路由
      setLastRoute: (route) => {
        set({ lastRoute: route })
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      // 手动触发 rehydrate（登录后调用）
      rehydrate: async () => {
        console.log('[PageState] 开始手动 rehydrate...')
        const stored = await encryptedStorage.getItem('page-state')
        console.log('[PageState] 读取到数据:', stored ? '有' : '无')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            console.log('[PageState] 解析数据:', parsed)
            if (parsed.state) {
              set({
                pages: parsed.state.pages || {},
                lastRoute: parsed.state.lastRoute || null,
                lastSaveTime: parsed.state.lastSaveTime || null,
                _hasHydrated: true,
              })
              console.log('[PageState] 手动 rehydrate 成功, pages:', Object.keys(parsed.state.pages || {}))
              return
            }
          } catch (e) {
            console.error('[PageState] rehydrate 解析失败:', e)
          }
        }
        set({ _hasHydrated: true })
      },
    }),
    {
      name: 'page-state',
      storage: createJSONStorage(() => encryptedStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
