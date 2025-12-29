import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Tauri HTTP 插件
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))
