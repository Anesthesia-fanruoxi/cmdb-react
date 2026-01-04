import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 获取构建时间
const buildTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 定义全局常量
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
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
        manualChunks(id) {
          // React 核心
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // 状态管理
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          // Tauri API
          if (id.includes('node_modules/@tauri-apps')) {
            return 'vendor-tauri';
          }
          // Monaco 编辑器（最大的依赖，按语言拆分）
          if (id.includes('node_modules/monaco-editor')) {
            if (id.includes('/esm/vs/language/')) {
              return 'vendor-monaco-lang';
            }
            if (id.includes('/esm/vs/editor/')) {
              return 'vendor-monaco-editor';
            }
            return 'vendor-monaco-core';
          }
          // Markdown 编辑器
          if (id.includes('node_modules/@uiw/react-md-editor') || 
              id.includes('node_modules/@uiw/react-markdown-preview')) {
            return 'vendor-md-editor';
          }
          // rehype/remark 处理器
          if (id.includes('node_modules/rehype') ||
              id.includes('node_modules/remark') ||
              id.includes('node_modules/unified') ||
              id.includes('node_modules/unist') ||
              id.includes('node_modules/hast') ||
              id.includes('node_modules/mdast')) {
            return 'vendor-md-processor';
          }
          // 图标库
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // 代码高亮
          if (id.includes('node_modules/prismjs') || 
              id.includes('node_modules/highlight.js') ||
              id.includes('node_modules/refractor')) {
            return 'vendor-highlight';
          }
          // 日期处理
          if (id.includes('node_modules/date-fns') ||
              id.includes('node_modules/dayjs')) {
            return 'vendor-date';
          }
        },
        // 资源文件命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // 块大小警告限制 (KB)
    chunkSizeWarningLimit: 1500,
    // 目标浏览器
    target: 'esnext',
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
})
