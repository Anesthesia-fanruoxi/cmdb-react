# BI查询页面增强工作计划

## TL;DR

> **目标**: 在React版BI查询页面添加查看表字段、编辑注释、CSV导入注释功能
>
> **核心改动**:
> - 新增 `DatabiColumnDetail` 组件（独立窗口）
> - 新增 `DatabiCsvImport` 组件（独立窗口）
> - 修改 `SqlDatabi` 添加右键菜单和CSV上传按钮
>
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - sequential dependencies

---

## Context

### 原始需求
用户在Vue版本的BI查询页面已实现以下功能，需要迁移到React版本：
1. 右键表节点 → 查看字段
2. 字段列表弹窗 → 编辑注释 → 保存
3. CSV导入 → 选择文件 → 预览 → 确认导入

### 技术背景
- Vue版本使用 SSE 流式获取表列表
- 字段相关API: `getDatabiColumnList`, `updateDatabiColumnComment`
- React版本使用 Tauri 独立窗口机制
- 需要在 `Detached/index.tsx` 注册新窗口类型

---

## Work Objectives

### Core Deliverables
1. **DatabiColumnDetail 组件** - 独立窗口显示表字段，支持编辑注释
2. **DatabiCsvImport 组件** - 独立窗口处理CSV导入
3. **右键菜单** - 在表树节点上右键显示"查看字段"选项
4. **CSV上传按钮** - 在项目选择器旁边添加上传按钮

### Must Have
- [ ] 添加 `getDatabiColumnList` 和 `updateDatabiColumnComment` API
- [ ] 创建 `DatabiColumnDetail` 组件（独立窗口）
- [ ] 创建 `DatabiCsvImport` 组件（独立窗口）
- [ ] 在 `Detached/index.tsx` 注册 `databi-column-detail` 和 `databi-csv-import` 窗口类型
- [ ] 修改 `SqlDatabi` 添加右键菜单
- [ ] 修改 `SqlDatabi` 添加CSV上传按钮

### Must NOT Have
- [ ] 不修改现有的 `TableDetailContent` 组件（保持SQL Search功能独立）
- [ ] 不实现导出功能（用户确认只需要导入）

---

## Execution Strategy

### Task 1: 添加API方法
**File**: `src/services/sql/databi.ts`

```typescript
// 新增获取表字段列表API
export const getDatabiColumnList = (project: string, table: string) => {
  return apiClient.get<DatabiColumnResponse[]>('/sql/databi/column/list', { project, table });
};

// 新增更新字段注释API
export const updateDatabiColumnComment = (data: {
  project: string;
  table: string;
  colName: string[];
  comment: string[];
}) => {
  return apiClient.post('/sql/databi/column/update', data);
};
```

**接口类型**:
```typescript
export interface DatabiColumnResponse {
  col_name: string;
  data_type: string;
  comment: string;
}
```

---

### Task 2: 创建 DatabiColumnDetail 组件
**File**: `src/pages/Sql/Databi/components/DatabiColumnDetail.tsx`

功能:
- 从URL参数获取 project 和 tableName
- 调用 `getDatabiColumnList` 获取字段列表
- 显示表格：字段名 | 数据类型 | 注释
- 支持单个字段编辑（点击编辑图标）
- 支持批量保存（保存所有修改按钮）
- 使用 Tauri 窗口主题

---

### Task 3: 创建 DatabiCsvImport 组件
**File**: `src/pages/Sql/Databi/components/DatabiCsvImport.tsx`

功能:
- 文件选择器（接受.csv）
- 解析CSV文件（格式：col_name,comment）
- 调用 `getDatabiColumnList` 获取当前表字段
- 匹配并显示预览：新注释 vs 旧注释
- 调用 `updateDatabiColumnComment` 确认导入

---

### Task 4: 注册窗口类型
**File**: `src/pages/Detached/index.tsx`

```typescript
case 'databi-column-detail': {
  const mod = await import('../Sql/Databi/components/DatabiColumnDetail');
  setComponent(() => mod.default);
  break;
}
case 'databi-csv-import': {
  const mod = await import('../Sql/Databi/components/DatabiCsvImport');
  setComponent(() => mod.default);
  break;
}
```

---

### Task 5: 修改 SqlDatabi 组件
**File**: `src/pages/Sql/Databi/index.tsx`

改动:
1. 添加右键菜单状态
2. 添加CSV上传ref
3. 添加右键菜单处理函数
4. 添加CSV文件处理函数
5. 在项目选择器添加CSV上传按钮
6. 在树节点上绑定右键事件

---

## Verification Strategy

> ALL verification is agent-executed. No human intervention.

- [ ] `npm run build` 编译成功
- [ ] `npm run lint` 无新增错误
- [ ] TypeScript 编译无错误
- [ ] 窗口打开功能正常

---

## Success Criteria

1. 右键点击表节点能打开"查看字段"菜单
2. 点击"查看字段"能打开独立窗口，显示字段列表
3. 能在窗口中编辑单个字段注释并保存
4. 能在窗口中批量保存所有修改
5. CSV上传按钮能正确打开导入窗口
6. CSV导入预览能正确显示匹配结果
7. CSV导入能正确更新字段注释
