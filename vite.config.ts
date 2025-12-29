import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 防止 Vite 清除 Rust 端的输出
  clearScreen: false,
  // Tauri 期望固定端口
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // 生产构建优化
  build: {
    // 输出目录
    outDir: 'dist',
    // 启用 sourcemap 用于调试（生产环境可设为 false）
    sourcemap: false,
    // 压缩选项
    minify: 'esbuild',
    // 分块策略
    rollupOptions: {
      output: {
        // 手动分块，优化加载性能
        manualChunks: {
          // React 相关库
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // 状态管理
          'vendor-state': ['zustand'],
          // HTTP 客户端
          'vendor-http': ['axios'],
        },
        // 资源文件命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // 块大小警告限制 (KB)
    chunkSizeWarningLimit: 500,
    // 目标浏览器
    target: 'esnext',
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
  },
})
