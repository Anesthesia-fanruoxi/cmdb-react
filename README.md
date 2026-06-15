# 资产管理桌面端

基于 React 18 + TypeScript + Tauri 构建的运维管理平台桌面客户端，支持 Web 与桌面双端运行。

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5.6 |
| 构建 | Vite 6 |
| 桌面端 | Tauri 2 |
| 路由 | React Router 7 |
| 状态管理 | Zustand |
| UI 组件 | Ant Design 6 + Lucide Icons |
| 图表 | ECharts 6 |
| Markdown | markdown-it + KaTeX + Mermaid |
| HTTP | Tauri HTTP Plugin |
| 测试 | Vitest + Testing Library |

## 功能模块

- **首页** - 数据概览与可视化面板
- **资产管理** - 资产信息维护与查询
- **作业管理** - 批量任务编排与执行
- **SQL 工具** - 在线 SQL 编辑与执行
- **监控中心** - 指标监控与告警
- **知识库** - 个人/公开/内部文档管理，支持 Markdown 编辑、上传、分享、历史版本
- **Agent 管理** - 主机代理接入与管理
- **系统设置** - 用户、权限、字典、审计等
- **消息中心** - 站内通知与任务追踪

## 快速开始

### 环境要求

- Node.js >= 18
- Rust（桌面端构建）
- Bun 或 npm / pnpm

### 安装依赖

```bash
bun install
# 或
npm install
```

### 开发模式

```bash
# Web 端
npm run dev:web

# 桌面端（Tauri）
npm run tauri:dev
```

### 构建

```bash
# Web 端
npm run build:web

# 桌面端安装包
npm run tauri:build
```

### 测试

```bash
npm run test          # 单次运行
npm run test:watch    # 监听模式
```

## 项目结构

```
src/
├── components/        # 全局通用组件
│   ├── ConfirmModal/  # 确认弹框（支持多按钮）
│   ├── Markdown/      # Markdown 渲染
│   ├── Layout/        # 页面布局
│   ├── Toast/         # 全局提示
│   └── ...
├── pages/             # 业务页面
│   ├── Home/          # 首页
│   ├── Knowledge/     # 知识库
│   ├── Monitor/       # 监控
│   ├── Sql/           # SQL 工具
│   ├── System/        # 系统设置
│   └── ...
├── services/          # API 接口封装
├── stores/            # Zustand 状态管理
├── hooks/             # 自定义 Hooks
├── utils/             # 工具函数
├── router/            # 路由配置
└── types/             # 类型定义
```

## 桌面端特性

- 基于 Tauri 2 原生封装，体积小、性能高
- 支持设备凭据自动登录，免重复输入密码
- 本地文件系统交互（文档下载、日志查看等）
- 系统通知集成
- 应用自动更新

## 配置说明

通过 `.env` 文件配置环境变量：

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_APP_VERSION=v1.0.0
```

## 许可证

私有项目，保留所有权利。
