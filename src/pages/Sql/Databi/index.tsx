/**
 * BI 查询页面
 */

import { useState, useEffect, useRef } from 'react';
import { 
  getDatabiProjects, 
  getDatabiTables, 
  executeDatabiQuery,
  type DatabiTablesResponse 
} from '@/services/sql/databi';
import { type Project } from '@/services/sql/search';
import { toast } from '@/components/AppNotification';
import SqlEditor, { type SqlEditorRef } from '../Search/components/SqlEditor';
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
  // 项目相关状态
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState('');

  // 表树相关状态
  const [tableLoading, setTableLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

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

  // 获取项目列表
  const fetchProjects = async () => {
    setProjectLoading(true);
    try {
      const res = await getDatabiProjects();
      console.log('BI查询项目列表原始响应:', res);
      console.log('响应数据详情:', JSON.stringify(res.data, null, 2));
      
      if (res.code === 200 && res.data) {
        let items: any[] = [];
        
        // 处理不同的响应格式，和 SQL Search 保持一致
        if (Array.isArray(res.data)) {
          console.log('数据格式: 直接数组');
          items = res.data;
        } else if (res.data.items) {
          console.log('数据格式: items 数组');
          items = res.data.items;
        } else if (res.data.list) {
          console.log('数据格式: list 数组');
          items = res.data.list;
        } else if (res.data.projects) {
          console.log('数据格式: projects 数组');
          items = res.data.projects;
        }
        
        console.log('提取的 items:', items);
        
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
          
          console.log('转换项目:', item, '->', project);
          return project;
        });
        
        console.log('转换后的项目列表:', projectList);
        setProjectList(projectList);
        
        if (projectList.length === 0) {
          toast.warning('暂无可用项目');
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
    setTableLoading(true);
    setTreeData([]);

    try {
      const res = await getDatabiTables(project);
      if (res.code === 200 && res.data) {
        buildTreeData(res.data);
      } else {
        toast.error(res.message || '获取表列表失败');
      }
    } catch (error) {
      console.error('获取表列表错误:', error);
      toast.error('获取表列表失败');
    } finally {
      setTableLoading(false);
    }
  };

  // 构建树形数据
  const buildTreeData = (data: DatabiTablesResponse) => {
    const tree: TreeNode[] = [];
    let nodeId = 0;

    Object.keys(data).forEach(dbName => {
      const dbNode: TreeNode = {
        id: `db_${nodeId++}`,
        label: dbName,
        type: 'database',
        children: []
      };

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
          setResultData(table);
        }

        setTook(Date.now() - startTime);

        if (table && table.length > 0) {
          toast.success(`查询成功，共 ${table.length} 条记录`);
        } else {
          toast.info('查询成功，无数据返回');
        }
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
  const renderTreeNode = (node: TreeNode) => (
    <div key={node.id}>
      <div
        className={`tree-node ${node.type}`}
        onClick={() => handleNodeClick(node)}
      >
        <span className="icon">
          {node.type === 'database' ? '🗄️' : '📄'}
        </span>
        <span>{node.label}</span>
      </div>
      {node.children && node.children.map(child => renderTreeNode(child))}
    </div>
  );

  // 组件挂载时初始化
  useEffect(() => {
    fetchProjects();
  }, []);

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
              <option value="">请选择项目</option>
              {projectList.map(project => (
                <option key={project.value} value={project.value}>
                  {project.label}
                </option>
              ))}
            </select>
          </div>

          <div className="table-tree">
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
          <div style={{ flex: 1, minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
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
                  <table className="result-table">
                    <thead>
                      <tr>
                        {resultColumns.map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultData.map((row, index) => (
                        <tr key={index}>
                          {resultColumns.map((_col, colIndex) => (
                            <td key={colIndex}>
                              {String(row[colIndex] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
