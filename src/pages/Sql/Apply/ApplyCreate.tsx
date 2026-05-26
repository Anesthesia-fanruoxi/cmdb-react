/**
 * SQL变更申请创建抽屉 - 使用 Ace 编辑器
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DatePicker, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { 
  getSqlApplyProjects, getProcessList, submitApply, checkSql,
  type ApplyProject, type ProcessInfo, type ApplyItem, type SqlCheckResult
} from '../../../services/sql/apply';
import { getDatabases } from '../../../services/sql/search';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import SqlAnalysisDialog from './SqlAnalysisDialog';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-xcode';
import 'ace-builds/src-noconflict/theme-twilight';
import 'ace-builds/src-noconflict/ext-language_tools';
import { createSqlCompleter, type TableInfo, type FieldInfo } from '../../../utils/sql';
import { getTables, getTableStructure } from '../../../services/sql/search';

interface Props {
  prefillData: Partial<ApplyItem> | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProjectOption {
  id: string;
  name: string;
  agent: number;
}

const ApplyCreateDrawer = ({ prefillData, onClose, onSuccess }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [, setProcessList] = useState<ProcessInfo[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [parseResults, setParseResults] = useState<SqlCheckResult[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const aceEditorRef = useRef<ace.Ace.Editor | null>(null);
  const processListRef = useRef<ProcessInfo[]>([]);
  const tablesRef = useRef<TableInfo[]>([]);
  const [, setTableList] = useState<TableInfo[]>([]);
  
  const [formData, setFormData] = useState({
    project: '', database: '', executeTime: '', apply: '', executor: '',
    applyId: null as number | null, executorId: null as number | null,
    remark: '', sqlContent: ''
  });

  // 加载表结构（用于智能提示）- 使用 ref 避免重新创建
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  
  const loadTableStructure = useCallback(async (tableName: string): Promise<FieldInfo[] | null> => {
    const { project, database } = formDataRef.current;
    if (!project || !database) return null;
    try {
      const res = await getTableStructure({ 
        agent: project, 
        dbName: database, 
        tbName: tableName 
      });
      if (res.code === 200 && res.data?.columns) {
        return res.data.columns.map(col => ({
          caption: col.field || col.name || '',
          value: col.field || col.name || '',
          meta: col.type || 'field',
          score: 900,
          comment: col.comment
        }));
      }
    } catch (e) { console.error('加载表结构失败:', e); }
    return null;
  }, []); // 空依赖，使用 ref 获取最新值

  // 初始化 Ace 编辑器
  useEffect(() => {
    if (!editorRef.current) return;
    
    const editor = ace.edit(editorRef.current);
    aceEditorRef.current = editor;
    
    const isDark = document.documentElement.classList.contains('dark');
    editor.setTheme(isDark ? 'ace/theme/twilight' : 'ace/theme/xcode');
    editor.session.setMode('ace/mode/sql');
    
    editor.setOptions({
      fontSize: '14px',
      showLineNumbers: true,
      tabSize: 2,
      wrap: true,
      printMargin: false,
      highlightActiveLine: true,
      showPrintMargin: false,
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: false
    });
    
    // 初始化自定义 SQL 补全器
    createSqlCompleter(ace, {
      getTables: () => tablesRef.current,
      loadTableStructure
    });
    
    editor.on('change', () => {
      setFormData(p => ({ ...p, sqlContent: editor.getValue() }));
    });
    
    const observer = new MutationObserver(() => {
      const isDarkNow = document.documentElement.classList.contains('dark');
      editor.setTheme(isDarkNow ? 'ace/theme/twilight' : 'ace/theme/xcode');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => {
      observer.disconnect();
      editor.destroy();
    };
  }, [loadTableStructure]);

  // 同步 sqlContent 到编辑器
  useEffect(() => {
    const editor = aceEditorRef.current;
    if (editor && formData.sqlContent && editor.getValue() !== formData.sqlContent) {
      editor.setValue(formData.sqlContent, 1);
    }
  }, [formData.sqlContent]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await getSqlApplyProjects();
      if (res.code === 200) {
        const items = (res.data as any)?.items || res.data || [];
        const mapped = (Array.isArray(items) ? items : []).map((item: ApplyProject) => ({
          id: item.project || '',
          name: item.project_name || '',
          agent: Number(item.agent || 0)
        }));
        setProjects(mapped);
      }
    } catch (e) { console.error('获取项目列表失败:', e); }
  }, []);

  const fetchProcessList = useCallback(async (): Promise<ProcessInfo[]> => {
    try {
      const res = await getProcessList();
      if (res.code === 200) {
        const list = res.data?.list || [];
        setProcessList(list);
        processListRef.current = list;
        return list;
      }
    } catch (e) { console.error('获取流程列表失败:', e); }
    return [];
  }, []);

  const fetchDatabases = useCallback(async (agent: string) => {
    try {
      const res = await getDatabases({ agent });
      if (res.code === 200 && res.data?.databases) {
        const dbs = res.data.databases;
        setDatabases(Array.isArray(dbs) ? dbs : Object.keys(dbs));
      }
    } catch (e) { console.error('获取数据库列表失败:', e); }
  }, []);

  // 加载表列表（用于智能提示）
  const fetchTables = useCallback(async (agent: string, dbName: string) => {
    try {
      const res = await getTables({ agent, dbName });
      if (res.code === 200 && res.data?.tables) {
        const tables = res.data.tables.map((name: string) => ({
          name,
          comment: ''
        }));
        setTableList(tables);
        tablesRef.current = tables;
      }
    } catch (e) { console.error('获取表列表失败:', e); }
  }, []);

  const handleProjectChange = async (projectId: string) => {
    // 清空相关字段
    setFormData(p => ({ 
      ...p, 
      project: projectId, 
      database: '', 
      apply: '', 
      executor: '', 
      applyId: null, 
      executorId: null 
    }));
    setDatabases([]);
    
    if (!projectId) return;
    
    // 获取流程列表（如果为空）
    let list = processListRef.current;
    if (list.length === 0) {
      list = await fetchProcessList();
    }
    
    // 找到选中的项目
    const selectedProject = projects.find(p => p.id === projectId);
    
    // 获取数据库列表
    await fetchDatabases(projectId);
    
    // 尝试多种方式匹配流程
    let matchedProcess: ProcessInfo | undefined;
    
    if (selectedProject) {
      // 1. 通过 agent 匹配
      if (selectedProject.agent) {
        matchedProcess = list.find(p => Number(p.agent) === Number(selectedProject.agent));
      }
      
      // 2. 通过项目名称匹配
      if (!matchedProcess) {
        matchedProcess = list.find(p => p.projectName === selectedProject.name);
      }
    }
    
    // 3. 直接用项目ID匹配
    if (!matchedProcess) {
      matchedProcess = list.find(p => {
        const processAgent = p.agent;
        return String(processAgent) === String(projectId);
      });
    }
    
    if (matchedProcess) {
      setFormData(p => ({
        ...p,
        apply: matchedProcess!.applyName || '',
        executor: matchedProcess!.executorName || '',
        applyId: matchedProcess!.applyId || null,
        executorId: matchedProcess!.executorId || null
      }));
    }
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.sql')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const editor = aceEditorRef.current;
          if (editor) {
            const current = editor.getValue();
            const newContent = current.trim() ? current.trimEnd() + '\n\n' + content : content;
            editor.setValue(newContent, 1);
          }
        };
        reader.readAsText(file);
      } else {
        toast.warning('请上传 .sql 文件');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project || !formData.database || !formData.sqlContent || !formData.remark) {
      toast.warning('请填写完整信息'); return;
    }
    if (!formData.applyId || !formData.executorId) {
      toast.warning('未匹配到审批人或执行人，请联系管理员配置流程'); return;
    }
    setSubmitting(true);
    try {
      const res = await checkSql({ 
        sql: formData.sqlContent, 
        project: formData.project, 
        database: formData.database 
      });
      if (res.code === 200 && res.data?.sql_results) {
        setParseResults(res.data.sql_results);
        setAnalysisVisible(true);
      } else toast.error(res.message || 'SQL检查失败');
    } catch (e) { 
      console.error('SQL检查失败:', e); 
      toast.error('SQL检查失败'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    const startTime = Date.now();
    const minDelay = () => {
      const elapsed = Date.now() - startTime;
      return elapsed < 500 ? new Promise(r => setTimeout(r, 500 - elapsed)) : Promise.resolve();
    };
    try {
      const data = {
        project: formData.project, 
        database_name: formData.database, 
        sql_content: formData.sqlContent,
        remark: formData.remark, 
        apply_id: formData.applyId, 
        apply_name: formData.apply,
        executor_id: formData.executorId, 
        executor_name: formData.executor,
        ...(isScheduled && formData.executeTime ? { execution_time: formData.executeTime } : {})
      };
      const res = await submitApply(data);
      await minDelay();
      if (res.code === 200) { 
        setAnalysisVisible(false); 
        onSuccess(); 
      } else toast.error(res.message || '提交失败');
    } catch (e) { 
      await minDelay();
      console.error('提交失败:', e); 
      toast.error('提交失败'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  useEffect(() => { 
    fetchProjects(); 
    fetchProcessList(); 
  }, [fetchProjects, fetchProcessList]);

  useEffect(() => {
    if (prefillData) {
      setFormData(p => ({
        ...p, 
        project: prefillData.project || '', 
        database: prefillData.database_name || '',
        sqlContent: prefillData.sql_content || '', 
        remark: prefillData.remark || '',
        // 如果预填充数据包含审批流程信息，直接使用
        apply: (prefillData as any).apply_name || '',
        executor: (prefillData as any).executor_name || '',
        applyId: (prefillData as any).apply_id || null,
        executorId: (prefillData as any).executor_id || null
      }));
      if (prefillData.project) {
        // 如果已有审批流程信息，不需要重新匹配
        if (!(prefillData as any).apply_id || !(prefillData as any).executor_id) {
          handleProjectChange(prefillData.project);
        } else {
          // 仍需加载数据库列表和表列表
          fetchDatabases(prefillData.project);
          if (prefillData.database_name) {
            fetchTables(prefillData.project, prefillData.database_name);
          }
        }
      }
    }
  }, [prefillData]); // eslint-disable-line

  const hasBlocker = parseResults.some(r => r.has_blocker);
  const updateForm = (key: string, val: string) => setFormData(p => ({ ...p, [key]: val }));

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer drawer-wide" onClick={e => e.stopPropagation()}>
          <div className="drawer-header">
            <h4>创建SQL变更申请</h4>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <form className="drawer-body create-form" onSubmit={handleSubmit}>
            <div className="form-layout">
              <div className="form-left">
                <div className="form-item form-item-inline">
                  <label><span className="required">*</span>所属项目</label>
                  <select value={formData.project} onChange={e => handleProjectChange(e.target.value)} required>
                    <option value="">请选择项目</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-item form-item-inline">
                  <label><span className="required">*</span>数据库</label>
                  <select value={formData.database} onChange={e => {
                    const db = e.target.value;
                    updateForm('database', db);
                    if (db && formData.project) {
                      fetchTables(formData.project, db);
                    } else {
                      setTableList([]);
                      tablesRef.current = [];
                    }
                  }} disabled={!formData.project} required>
                    <option value="">请选择数据库</option>
                    {databases.map(db => <option key={db} value={db}>{db}</option>)}
                  </select>
                </div>
                <div className="form-item form-item-inline">
                  <label>执行时间</label>
                  <div className="switch-row">
                    <span className={`switch-text ${!isScheduled ? 'active' : ''}`}>立即执行</span>
                    <label className="switch">
                      <input type="checkbox" checked={isScheduled} onChange={async e => {
                        const checked = e.target.checked;
                        if (checked) {
                          const confirmed = await confirm({ title: '定时执行', content: '您已开启定时执行，请选择执行时间', type: 'info' });
                          if (!confirmed) return;
                          setIsScheduled(true);
                          updateForm('executeTime', dayjs().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'));
                        } else {
                          setIsScheduled(false);
                          updateForm('executeTime', '');
                        }
                      }} />
                      <span className="slider"></span>
                    </label>
                    <span className={`switch-text ${isScheduled ? 'active' : ''}`}>定时执行</span>
                  </div>
                </div>
                {isScheduled && (
                  <div className="form-item form-item-inline">
                    <label></label>
                    <ConfigProvider locale={zhCN}>
                      <DatePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        placeholder="选择执行时间"
                        value={formData.executeTime ? dayjs(formData.executeTime) : null}
                        onChange={(date) => updateForm('executeTime', date ? date.format('YYYY-MM-DD HH:mm:ss') : '')}
                        style={{ flex: 1 }}
                        allowClear
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                        disabledTime={(current) => {
                          if (!current || !current.isSame(dayjs(), 'day')) return {};
                          const now = dayjs();
                          return {
                            disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
                            disabledMinutes: (hour: number) => hour === now.hour() ? Array.from({ length: now.minute() }, (_, i) => i) : [],
                            disabledSeconds: (hour: number, minute: number) => hour === now.hour() && minute === now.minute() ? Array.from({ length: now.second() }, (_, i) => i) : []
                          };
                        }}
                      />
                    </ConfigProvider>
                  </div>
                )}
                <div className="form-item form-item-inline">
                  <label>审批人</label>
                  <input type="text" value={formData.apply} disabled placeholder="系统自动分配" />
                </div>
                <div className="form-item form-item-inline">
                  <label>执行人</label>
                  <input type="text" value={formData.executor} disabled placeholder="系统自动分配" />
                </div>
                <div className="form-item form-item-inline">
                  <label><span className="required">*</span>备注</label>
                  <textarea value={formData.remark} onChange={e => updateForm('remark', e.target.value)} placeholder="请输入变更说明" rows={4} required />
                </div>
              </div>
              <div className="form-right">
                <div className="sql-header">
                  <span>SQL内容 <span className="required">*</span></span>
                  <span className="hint">支持拖拽 .sql 文件到编辑器</span>
                </div>
                <div 
                  className={`sql-editor-wrapper ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div ref={editorRef} className="ace-editor-container" />
                  {isDragOver && (
                    <div className="drag-overlay">
                      <span>释放文件以上传</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-default" onClick={onClose}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '检查中...' : '提交申请'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {analysisVisible && (
        <SqlAnalysisDialog 
          sqlList={parseResults} 
          hasBlocker={hasBlocker} 
          onConfirm={handleConfirmSubmit} 
          onCancel={() => setAnalysisVisible(false)} 
          submitting={submitting} 
        />
      )}
    </>
  );
};

export default ApplyCreateDrawer;
