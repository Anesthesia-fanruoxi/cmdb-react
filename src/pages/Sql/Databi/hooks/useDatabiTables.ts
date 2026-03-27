/**
 * BI 查询表树管理 Hook
 */

import { useState, useRef } from 'react';
import { 
  getDatabiTables, 
  refreshDatabiTables,
  type DatabiTablesResponse,
  type SseEventData
} from '@/services/sql/databi';
import { toast } from '@/components/AppNotification';
import type { TreeNode } from '../types';

export const useDatabiTables = () => {
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const sseConnectionRef = useRef<EventSource | null>(null);

  // 关闭 SSE 连接
  const closeSseConnection = () => {
    if (sseConnectionRef.current) {
      sseConnectionRef.current.close();
      sseConnectionRef.current = null;
    }
  };

  // 构建树形数据
  const buildTreeData = (data: DatabiTablesResponse) => {
    const tree: TreeNode[] = [];
    let nodeId = 0;
    const newExpandedKeys = new Set<string>();

    Object.keys(data).forEach((dbName, index) => {
      const dbNode: TreeNode = {
        id: `db_${nodeId++}`,
        label: dbName,
        type: 'database',
        children: []
      };

      // 默认展开第一个数据库
      if (index === 0) {
        newExpandedKeys.add(dbNode.id);
      }

      const tables = data[dbName] || [];
      tables.forEach(tableName => {
        dbNode.children!.push({
          id: `table_${nodeId++}`,
          label: tableName,
          type: 'table',
          database: dbName,
          table: tableName
        });
      });

      tree.push(dbNode);
    });

    setTreeData(tree);
    setExpandedKeys(newExpandedKeys);
  };

  // 处理 SSE 事件
  const handleSseEvent = (data: SseEventData) => {
    const { type, message, progress, tables, error } = data;
    
    switch (type) {
      case 'idle':
        setRefreshMessage(message || '请点击刷新按钮');
        setTableLoading(false);
        break;
        
      case 'cached':
        setRefreshMessage(message || '使用缓存数据');
        if (tables) {
          buildTreeData(tables);
        }
        setTableLoading(false);
        setRefreshLoading(false);
        break;
        
      case 'refreshing':
        setRefreshProgress(progress || 20);
        setRefreshMessage(message || '正在刷新插件缓存...');
        setRefreshLoading(true);
        break;
        
      case 'loading':
        setRefreshProgress(progress || 60);
        setRefreshMessage(message || '正在加载表列表...');
        setRefreshLoading(true);
        break;
        
      case 'success':
        setRefreshProgress(100);
        setRefreshMessage(message || '刷新完成');
        if (tables) {
          buildTreeData(tables);
          toast.success('刷新成功');
        }
        setTableLoading(false);
        setRefreshLoading(false);
        break;
        
      case 'error':
        setRefreshMessage(error || message || '刷新失败');
        toast.error(error || message || '刷新失败');
        setTableLoading(false);
        setRefreshLoading(false);
        break;
    }
  };

  // 项目切换
  const handleProjectChange = async (project: string) => {
    if (!project) return;

    closeSseConnection();
    
    setTableLoading(true);
    setTreeData([]);
    setRefreshProgress(0);
    setRefreshMessage('');

    try {
      sseConnectionRef.current = getDatabiTables(
        project,
        handleSseEvent,
        (error) => {
          console.error('SSE 错误:', error);
          setTableLoading(false);
          setRefreshLoading(false);
          toast.error('连接失败，请重试');
        }
      );
    } catch (error) {
      console.error('建立 SSE 连接错误:', error);
      toast.error('连接失败');
      setTableLoading(false);
    }
  };

  // 刷新表列表
  const handleRefresh = async (project: string) => {
    if (!project) {
      toast.warning('请先选择项目');
      return;
    }
    
    setRefreshLoading(true);
    setRefreshProgress(0);
    setRefreshMessage('正在触发刷新任务...');
    
    try {
      closeSseConnection();
      
      const res = await refreshDatabiTables(project);
      
      if (res.code === 200) {
        setRefreshMessage(res.message || '刷新任务已启动');
        
        sseConnectionRef.current = getDatabiTables(
          project,
          handleSseEvent,
          (error) => {
            console.error('SSE 错误:', error);
            setRefreshLoading(false);
            toast.error('连接失败，请重试');
          }
        );
      } else {
        toast.error(res.message || '触发刷新失败');
        setRefreshLoading(false);
      }
    } catch (error) {
      console.error('触发刷新错误:', error);
      toast.error('触发刷新失败');
      setRefreshLoading(false);
    }
  };

  // 切换展开/收起
  const toggleExpand = (nodeId: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  return {
    tableLoading,
    refreshLoading,
    treeData,
    refreshProgress,
    refreshMessage,
    expandedKeys,
    closeSseConnection,
    handleProjectChange,
    handleRefresh,
    toggleExpand
  };
};
