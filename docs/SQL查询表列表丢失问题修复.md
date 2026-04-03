# SQL查询表列表丢失问题修复

## 📋 问题描述

用户反馈:在SQL查询页面,隔一段时间切换数据库时,表列表会丢失,显示"暂无表"。

## 🔍 问题分析

### 原因1: 状态更新时序问题

**原代码逻辑:**
```typescript
const handleDbChange = async (dbName: string, tabId: string) => {
  // 1. 先清空表列表 ❌
  updateTab(tabId, { dbName, tableList: [] });
  
  // 2. 异步导入模块
  const { getDbTables } = await import('../../../utils/sql/cache');
  
  // 3. 从缓存读取
  const tableList = getDbTables(dbName);
  
  // 4. 再更新表列表
  updateTab(tabId, { tableList });
};
```

**问题:**
1. 先清空 `tableList: []`,UI立即显示"暂无表"
2. 然后异步操作,有延迟
3. 如果缓存不存在,就永远是空的

### 原因2: 缓存可能被清理

**缓存存储位置:**
```typescript
// 全局内存缓存
window.sqlMetadataCache = {
  databases: string[],           // 所有数据库名
  dbTables: {                    // 数据库->表映射
    [dbName]: string[]
  },
  tableStats: {                  // 表统计信息
    [tableName]: { rowCount, dataLength }
  }
}
```

**缓存被清理的情况:**

1. **切换项目时**
   ```typescript
   handleProjectChange(project, tabId) {
     // 清空数据库和表列表
     updateTab(tabId, { 
       project, 
       dbName: '', 
       dbList: [], 
       tableList: [],  // ❌ 清空
       metadataCacheAge: null 
     });
     
     // 重新获取元数据
     await fetchAndCacheMetadata(project, tabId);
   }
   ```

2. **内存缓存是全局共享的**
   - 所有标签页共享同一个 `window.sqlMetadataCache`
   - 切换项目时,新项目的数据会覆盖旧项目的缓存
   - 如果回到旧项目,缓存可能已经不存在了

3. **页面刷新或重启应用**
   - 内存缓存会丢失
   - 需要从文件存储(`states.dat`)恢复
   - 如果文件不存在或过期,缓存就丢失了

## ✅ 解决方案

### 修复1: 优化状态更新时序

**新代码逻辑:**
```typescript
const handleDbChange = async (dbName: string, tabId: string) => {
  if (dbName && project) {
    // 1. 先从缓存读取 ✅
    const { getDbTables } = await import('../../../utils/sql/cache');
    const tableList = getDbTables(dbName);
    
    // 2. 一次性更新,避免中间状态 ✅
    updateTab(tabId, { dbName, tableList });
  } else {
    // 3. 没有数据库名才清空
    updateTab(tabId, { dbName, tableList: [] });
  }
};
```

**优势:**
- ✅ 避免了中间的空状态
- ✅ 减少了UI闪烁
- ✅ 如果缓存存在,立即显示

### 修复2: 缓存持久化机制

**已有的持久化机制:**
```typescript
// 1. 获取元数据后,持久化到文件
await persistMetadataToStorage(project, userName);

// 2. 切换项目时,先尝试从文件恢复
const restored = await restoreMetadataFromStorage(project, userName);

if (restored) {
  // 使用缓存数据
  const cachedDbList = getAllCachedDatabases();
  updateTab(tabId, { dbList: cachedDbList });
} else {
  // 调用API获取
  await fetchAndCacheMetadata(project, tabId);
}
```

**文件存储位置:**
- Windows: `%APPDATA%/com.cmdb.desktop/states.dat`
- macOS: `~/Library/Application Support/com.cmdb.desktop/states.dat`
- Linux: `~/.config/com.cmdb.desktop/states.dat`

## 🎯 用户使用建议

### 1. 刷新元数据

如果发现表列表丢失,点击刷新按钮:

```
[项目选择器] [数据库选择器] [🔄 刷新]
```

刷新会:
- 重新从后端获取元数据
- 更新内存缓存
- 持久化到文件

### 2. 缓存时间显示

界面会显示缓存的时间:
```
元数据缓存: 2小时前
```

如果显示时间很久,建议手动刷新。

### 3. 多项目切换

如果频繁在多个项目间切换:
- 每个项目的缓存是独立的
- 切换回旧项目时,会自动从文件恢复缓存
- 如果恢复失败,会自动调用API获取

## 🔧 技术细节

### 缓存层级

```
┌─────────────────────────────────────┐
│  内存缓存 (window.sqlMetadataCache)  │
│  - 快速访问                          │
│  - 全局共享                          │
│  - 页面刷新丢失                      │
└──────────────┬──────────────────────┘
               │ 持久化
               ↓
┌─────────────────────────────────────┐
│  文件存储 (states.dat)               │
│  - 加密存储                          │
│  - 按用户+项目分组                   │
│  - 永久保存                          │
└─────────────────────────────────────┘
```

### 缓存数据结构

```typescript
{
  version: '1.0',
  timestamp: 1234567890,  // 缓存时间
  databases: ['db1', 'db2'],
  dbTables: {
    'db1': ['table1', 'table2'],
    'db2': ['table3', 'table4']
  },
  tableStats: {
    'table1': { rowCount: 1000, dataLength: 1024000 }
  },
  fields: {
    'table1': [
      { caption: 'id', meta: 'int', comment: '主键' },
      { caption: 'name', meta: 'varchar', comment: '名称' }
    ]
  }
}
```

## 📊 修复效果

### 修复前:
```
用户切换数据库 → 清空表列表 → 显示"暂无表" → 异步读取缓存 → 更新表列表
                  ↑ 用户看到空状态 ↑
```

### 修复后:
```
用户切换数据库 → 读取缓存 → 一次性更新数据库名和表列表
                           ↑ 用户直接看到表列表 ↑
```

## ✅ 总结

通过优化状态更新时序,避免了中间的空状态,减少了UI闪烁,提升了用户体验。

如果仍然遇到表列表丢失的问题,可以:
1. 点击刷新按钮手动刷新元数据
2. 检查缓存时间,如果太久建议刷新
3. 如果问题持续,可能是后端元数据接口的问题
