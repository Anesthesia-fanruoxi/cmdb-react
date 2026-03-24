/**
 * BI 查询页面
 */

import { useState, useEffect, useRef } from 'react';
import { Database, Table, ChevronRight, ChevronDown } from 'lucide-react';
import { 
  getDatabiProjects, 
  getDatabiTables, 
  refreshDatabiTables,
  executeDatabiQuery,
  type DatabiTablesResponse,
  type SseEventData
} from '@/services/sql/databi';
import { type Project } from '@/services/sql/search';
import { toast } from '@/components/AppNotification';
import SqlEditor, { type SqlEditorRef } from '../Search/components/SqlEditor';
import { usePageStateStore } from '@/stores';
import './index.css';

/** 树节点类型 */
interface TreeNode {
  id: string;
  label: string;
  type: 'database' | 'table';
  database?: string;
  table?: string;
  children?: TreeNode[];
}

const SqlDatabi = () => {
  // 页面状态管理
  const { setPageState, getPageState, _hasHydrated } = usePageStateStore();
  const PAGE_KEY = 'sql/databi';
  const hasRestored = useRef(false);

  // 项目相关状态
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState('');

  // 表树相关状态
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const sseConnectionRef = useRef<EventSource | null>(null);

  // 刷新进度
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // SQL 编辑器
  const sqlEditorRef = useRef<SqlEditorRef>(null);
  const [sqlQuery, setSqlQuery] = useState('');

  // 查询结果
  const [queryLoading, setQueryLoading] = useState(false);
  const [resultData, setResultData] = useState<unknown[][]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [took, setTook] = useState(0);

  // 编辑器高度拖拽
  const [editorHeightPercent, setEditorHeightPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartPercent = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 关闭 SSE 连接
  const closeSseConnection = () => {
    if (sseConnectionRef.current) {
      sseConnectionRef.current.close();
      sseConnectionRef.current = null;
    }
  };

  // 获取项目列表
  const fetchProjects = async () => {
    setProjectLoading(true);
    try {
      const res = await getDatabiProjects();
      
      if (res.code === 200 && res.data) {
        let items: any[] = [];
        
        // 处理不同的响应格式，和 SQL Search 保持一致
        if (Array.isArray(res.data)) {
          items = res.data;
        } else if (res.data.items) {
          items = res.data.items;
        } else if (res.data.list) {
          items = res.data.list;
        } else if (res.data.projects) {
          items = res.data.projects;
        }
        
        // 转换为标准的项目格式
        const projectList = items.map(item => {
          // 如果是字符串，转换为对象
          if (typeof item === 'string') {
            return {
              label: item,
              value: item,
              project: item,
              project_name: item
            };
          }
          
          // 如果是对象，提取字段
          const project = {
            label: item.project_name || item.label || item.name || item.value || item.project || '',
            value: item.project || item.value || item.key || item.name || '',
            project: item.project || item.value || item.key || item.name || '',
            project_name: item.project_name || item.label || item.name || item.value || item.project || ''
          };
          
          return project;
        });
        
        setProjectList(projectList);
        
        if (projectList.length === 0) {
          toast.warning('暂无可用项目');
        } else {
          // 如果当前没有选中项目,默认选中 dwd
          if (!currentProject) {
            const dwdProject = projectList.find(p => p.value === 'dwd');
            if (dwdProject) {
              setCurrentProject('dwd');
              handleProjectChange('dwd');
            } else {
              // 如果没有 dwd,选中第一个项目
              setCurrentProject(projectList[0].value);
              handleProjectChange(projectList[0].value);
            }
          }
        }
      } else {
        toast.error(res.message || '获取项目列表失败');
      }
    } catch (error) {
      console.error('获取项目列表错误:', error);
      toast.error('获取项目列表失败');
    } finally {
      setProjectLoading(false);
    }
  };

  // 项目切换
  const handleProjectChange = async (project: string) => {
    if (!project) return;

    setCurrentProject(project);
    
    // 关闭之前的 SSE 连接
    closeSseConnection();
    
    setTableLoading(true);
    setTreeData([]);
    setRefreshProgress(0);
    setRefreshMessage('');

    try {
      // 建立 SSE 连接
      sseConnectionRef.current = getDatabiTables(
        project,
        // onMessage
        (data) => {
          handleSseEvent(data);
        },
        // onError
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

  // 刷新项目的库和表
  const handleRefresh = async () => {
    if (!currentProject) {
      toast.warning('请先选择项目');
      return;
    }
    
    setRefreshLoading(true);
    setRefreshProgress(0);
    setRefreshMessage('正在触发刷新任务...');
    
    try {
      // 1. 关闭旧的 SSE 连接
      closeSseConnection();
      
      // 2. 触发刷新任务
      const res = await refreshDatabiTables(currentProject);
      
      if (res.code === 200) {
        setRefreshMessage(res.message || '刷新任务已启动');
        
        // 3. 重新建立 SSE 连接
        sseConnectionRef.current = getDatabiTables(
          currentProject,
          // onMessage
          (data) => {
            handleSseEvent(data);
          },
          // onError
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

  // 树节点点击
  const handleNodeClick = (node: TreeNode) => {
    if (node.type === 'table' && sqlEditorRef.current && node.database && node.table) {
      const insertText = `${node.database}.${node.table}`;
      const editor = sqlEditorRef.current.getEditor();
      if (editor) {
        const cursorPosition = editor.getCursorPosition();
        editor.session.insert(cursorPosition, insertText);
        editor.focus();
      }
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

  // 执行查询
  const executeQuery = async () => {
    const sql = sqlQuery.trim();
    if (!sql) {
      toast.warning('请输入SQL查询语句');
      return;
    }

    if (!currentProject) {
      toast.warning('请先选择项目');
      return;
    }

    setQueryLoading(true);
    setResultData([]);
    setResultColumns([]);
    setTook(0);

    try {
      const startTime = Date.now();
      const res = await executeDatabiQuery({
        project: currentProject,
        context: sql,
        type: 'sql'
      });

      if (res.code === 200 && res.data) {
        const { head, table } = res.data;

        if (head && head.length > 0) {
          setResultColumns(head);
        }

        if (table && table.length > 0) {
          // 检查数据格式：如果第一行是对象，直接使用；如果是数组，需要转换
          const firstRow = table[0];
          if (Array.isArray(firstRow)) {
            // 二维数组格式，需要转换为对象数组
            const convertedData = table.map((row: any[]) => {
              const obj: Record<string, any> = {};
              head.forEach((col: string, index: number) => {
                obj[col] = row[index];
              });
              return obj;
            });
            setResultData(convertedData as any);
          } else {
            // 已经是对象数组格式
            setResultData(table);
          }
        }

        setTook(Date.now() - startTime);
      } else {
        toast.error(res.message || '查询失败');
      }
    } catch (error) {
      console.error('查询失败:', error);
      toast.error('查询失败');
    } finally {
      setQueryLoading(false);
    }
  };

  // 清空编辑器
  const clearEditor = () => {
    setSqlQuery('');
    setResultData([]);
    setResultColumns([]);
    setTook(0);
  };

  // 渲染树节点
  const renderTreeNode = (node: TreeNode) => {
    const isExpanded = expandedKeys.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="tree-node-wrapper">
        <div
          className={`tree-node ${node.type}`}
          onClick={() => {
            if (node.type === 'database') {
              toggleExpand(node.id);
            } else {
              handleNodeClick(node);
            }
          }}
        >
          {node.type === 'database' && hasChildren && (
            <span className="expand-icon">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="node-icon">
            {node.type === 'database' ? (
              <Database size={16} />
            ) : (
              <Table size={16} />
            )}
          </span>
          <span className="node-label">{node.label}</span>
        </div>
        {node.type === 'database' && hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children!.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  // 组件挂载时初始化
  useEffect(() => {
    fetchProjects();
    
    // 组件卸载时关闭 SSE 连接
    return () => {
      closeSseConnection();
    };
  }, []);

  // 恢复保存的状态
  useEffect(() => {
    if (!_hasHydrated || hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = getPageState<{
        currentProject: string;
        sqlQuery: string;
        editorHeightPercent: number;
      }>(PAGE_KEY);

      if (saved) {
        // 只恢复项目选择,不自动建立 SSE 连接
        if (saved.currentProject) {
          setCurrentProject(saved.currentProject);
          // 不调用 handleProjectChange,等用户手动选择或刷新
        }
        if (saved.sqlQuery) {
          setSqlQuery(saved.sqlQuery);
        }
        if (saved.editorHeightPercent) {
          setEditorHeightPercent(saved.editorHeightPercent);
        }
      }
    } catch (error) {
      console.error('恢复 BI 查询页面状态失败:', error);
    }
  }, [_hasHydrated, getPageState]);

  // 保存状态（防抖）
  useEffect(() => {
    if (!_hasHydrated || !hasRestored.current) return;

    const timer = setTimeout(() => {
      setPageState(PAGE_KEY, {
        currentProject,
        sqlQuery,
        editorHeightPercent,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [currentProject, sqlQuery, editorHeightPercent, setPageState, _hasHydrated]);

  // 复制整列
  const handleCopyColumn = (colIndex: number) => {
    const col = resultColumns[colIndex];
    const values = resultData.map(row => {
      const value = typeof row === 'object' && !Array.isArray(row)
        ? row[col]
        : row[colIndex];
      return String(value ?? '');
    });
    
    navigator.clipboard.writeText(values.join('\n')).then(() => {
      toast.success('已复制整列数据');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  // 复制整行（JSON 格式）
  const handleCopyRow = (rowIndex: number) => {
    const row = resultData[rowIndex];
    const rowObject: Record<string, any> = {};
    
    resultColumns.forEach((col, colIndex) => {
      const value = typeof row === 'object' && !Array.isArray(row)
        ? row[col]
        : row[colIndex];
      rowObject[col] = value;
    });
    
    const jsonString = JSON.stringify(rowObject, null, 2);
    
    navigator.clipboard.writeText(jsonString).then(() => {
      toast.success('已复制整行数据（JSON 格式）');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  // 处理拖动开始
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartPercent.current = editorHeightPercent;
  };

  // 处理拖动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerHeight = containerRef.current.clientHeight;
      const delta = e.clientY - dragStartY.current;
      const deltaPercent = (delta / containerHeight) * 100;
      
      // 限制范围：10% - 90%
      const newPercent = Math.max(10, Math.min(90, dragStartPercent.current + deltaPercent));
      setEditorHeightPercent(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="sql-databi-container">
      <div className="main-content">
        {/* 左侧表树 */}
        <div className="sidebar">
          <div className="project-selector">
            <select
              value={currentProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              disabled={projectLoading}
            >
              {projectList.map(project => (
                <option key={project.value} value={project.value}>
                  {project.label}
                </option>
              ))}
            </select>
            <button
              className="btn-refresh"
              onClick={handleRefresh}
              disabled={!currentProject || refreshLoading}
              title="刷新表列表"
            >
              {refreshLoading ? '⟳' : '↻'}
            </button>
          </div>

          <div className="table-tree">
            {/* 刷新进度提示 */}
            {refreshLoading && refreshMessage && (
              <div className="refresh-status">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${refreshProgress}%` }}
                  />
                </div>
                <span className="status-text">{refreshMessage}</span>
              </div>
            )}
            
            {tableLoading ? (
              <div className="loading">加载中...</div>
            ) : treeData.length > 0 ? (
              treeData.map(node => renderTreeNode(node))
            ) : (
              <div className="empty-state">
                <span>请先选择项目</span>
              </div>
            )}
          </div>
        </div>

        {/* 右侧SQL工作区 */}
        <div ref={containerRef} className="content">
          {/* 工具栏 */}
          <div className="workspace-toolbar">
            <div className="toolbar-left">
              <button
                className="btn btn-primary"
                onClick={executeQuery}
                disabled={queryLoading || !currentProject}
              >
                {queryLoading ? '执行中...' : '▶ 执行'}
              </button>
              <button className="btn" onClick={clearEditor} disabled={!sqlQuery}>
                清空
              </button>
            </div>
          </div>

          {/* 编辑器容器 */}
          <div
            className="editor-container"
            style={{ height: `${editorHeightPercent}%`, flexShrink: 0 }}
          >
            <SqlEditor
              ref={sqlEditorRef}
              value={sqlQuery}
              onChange={setSqlQuery}
              onExecute={executeQuery}
              loading={queryLoading}
            />
          </div>

          {/* 拖拽分隔条 */}
          <div
            className={`editor-resize-handle ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleDragStart}
          >
            <div className="resize-handle-bar" />
          </div>

          {/* 查询结果 - 占用剩余空间 */}
          <div className="result-panel-wrapper">
            <div className="result-section">
              <div className="result-header">
                <span className="title">查询结果</span>
                {resultData.length > 0 && (
                  <span className="info">
                    共 {resultData.length} 条记录
                    {took > 0 && ` | 耗时: ${took}ms`}
                  </span>
                )}
              </div>

              <div className="result-content">
                {queryLoading ? (
                  <div className="loading">查询中...</div>
                ) : resultData.length > 0 ? (
                  <>
                    <table className="result-table">
                      <thead>
                        <tr>
                          <th className="copy-column">#</th>
                          {resultColumns.map((col, colIndex) => (
                            <th key={col}>
                              <div className="th-content">
                                <span>{col}</span>
                                <button
                                  className="copy-btn"
                                  onClick={() => handleCopyColumn(colIndex)}
                                  title="复制整列"
                                >
                                  📋
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultData.map((row, rowIndex) => {
                          return (
                            <tr key={rowIndex}>
                              <td className="copy-column">
                                <button
                                  className="copy-btn"
                                  onClick={() => handleCopyRow(rowIndex)}
                                  title="复制整行"
                                >
                                  📋
                                </button>
                              </td>
                              {resultColumns.map((col, colIndex) => {
                                // 支持对象格式和数组格式
                                const value = typeof row === 'object' && !Array.isArray(row)
                                  ? row[col]  // 对象格式：使用列名作为 key
                                  : row[colIndex];  // 数组格式：使用索引
                                return (
                                  <td key={colIndex}>
                                    {String(value ?? '')}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="empty-state">
                    <span>暂无数据</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlDatabi;
