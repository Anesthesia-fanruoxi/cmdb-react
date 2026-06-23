/**
 * 插件安装抽屉
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { installContainerPlugin, installBinaryPlugin, getPluginDetail, StorePlugin, StoreProject, ContainerInstallRequest, BinaryInstallRequest } from '@/services/agent/store';
import toast from '@/components/Toast';
import { parseConfigTemplate, renderConfigTemplate, createEmptyItem, type TemplateVar, type SimpleVar, type ArrayVar } from './configTemplateParser';

interface ConfigItem { key: string; value: string; }

interface Props {
  visible: boolean;
  plugin: StorePlugin | null;
  projects: StoreProject[];
  onClose: () => void;
  onSuccess: () => void;
}

// 插件默认配置
const PLUGIN_DEFAULT_CONFIGS: Record<string, ConfigItem[]> = {
  'sql-plugs': [
    { key: 'MYSQL_ADDR', value: '192.168.6.2' },
    { key: 'MYSQL_PORT', value: '3306' },
    { key: 'MYSQL_DB', value: 'test' },
    { key: 'MYSQL_USER', value: 'root' },
    { key: 'MYSQL_PASSWORD', value: '******' },
    { key: 'LOG_LEVEL', value: 'error' }
  ],
  'es-plugs': [
    { key: 'ES_HOST', value: 'http://localhost:9200' },
    { key: 'ES_USERNAME', value: 'elastic' },
    { key: 'ES_PASSWORD', value: '******' },
    { key: 'LOG_LEVEL', value: 'error' },
    { key: 'LIMIT_MAX_SIZE', value: '1000' }
  ],
  'key-plugs': [
    { key: 'key', value: '******' }
  ],
  'redis-plugs': [
    { key: 'REDIS_HOST', value: '192.168.3.10' },
    { key: 'REDIS_PORT', value: '40782' },
    { key: 'REDIS_DB', value: '0' },
    { key: 'REDIS_PASSWORD', value: '123456' }
  ],
  'al-plugs': [
    { key: 'ALIBABA_CLOUD_ACCESS_KEY_ID', value: '' },
    { key: 'ALIBABA_CLOUD_ACCESS_KEY_SECRET', value: '' },
    { key: 'ALIBABA_CLOUD_REGION_ID', value: 'cn-hangzhou' },
    { key: 'ALERT_WEBHOOK_URL', value: '' },
    { key: 'ALERT_PROJECT', value: '' },
    { key: 'ALERT_BALANCE_THRESHOLD', value: '' },
    { key: 'ALERT_SUPPRESS_HOURS', value: '' },
    { key: 'ALERT_CHECK_INTERVAL_MINUTES', value: '' }
  ],
};

// 配置项中文说明
const CONFIG_DESCRIPTIONS: Record<string, string> = {
  // 阿里云插件
  'ALIBABA_CLOUD_ACCESS_KEY_ID': '阿里云访问密钥 ID',
  'ALIBABA_CLOUD_ACCESS_KEY_SECRET': '阿里云访问密钥',
  'ALIBABA_CLOUD_REGION_ID': '阿里云区域 ID（如：cn-hangzhou）',
  'ALERT_WEBHOOK_URL': '告警 Webhook URL',
  'ALERT_PROJECT': '告警项目名称',
  'ALERT_BALANCE_THRESHOLD': '余额告警阈值（如：100）',
  'ALERT_SUPPRESS_HOURS': '告警抑制时长（小时，如：24）',
  'ALERT_CHECK_INTERVAL_MINUTES': '告警检查间隔（分钟，如：60）',
  
  // MySQL 插件
  'MYSQL_ADDR': 'MySQL 服务器地址',
  'MYSQL_PORT': 'MySQL 端口号',
  'MYSQL_DB': 'MySQL 数据库名',
  'MYSQL_USER': 'MySQL 用户名',
  'MYSQL_PASSWORD': 'MySQL 密码',
  
  // ES 插件
  'ES_HOST': 'Elasticsearch 地址',
  'ES_USERNAME': 'Elasticsearch 用户名',
  'ES_PASSWORD': 'Elasticsearch 密码',
  'LIMIT_MAX_SIZE': '查询结果最大数量',
  
  // Redis 插件
  'REDIS_HOST': 'Redis 服务器地址',
  'REDIS_PORT': 'Redis 端口号',
  'REDIS_DB': 'Redis 数据库编号',
  'REDIS_PASSWORD': 'Redis 密码',
  
  // 通用
  'LOG_LEVEL': '日志级别（如：error、info、debug）',
  'key': '密钥',
};


// 获取配置项的中文说明
const getConfigDescription = (key: string): string => {
  return CONFIG_DESCRIPTIONS[key] || '请输入参数值';
};

// 获取插件默认配置
const getPluginDefaultConfig = (pluginName: string): ConfigItem[] => {
  return PLUGIN_DEFAULT_CONFIGS[pluginName] || [];
};



const InstallDrawer = ({ visible, plugin, projects, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [enableConfig, setEnableConfig] = useState(false);
  const [configList, setConfigList] = useState<ConfigItem[]>([]);
  const [configContent, setConfigContent] = useState('');

  // 配置模板（从后端获取的含 {{.VAR}} 变量模板）
  const [configTemplate, setConfigTemplate] = useState('');

  // 预览弹框
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewVars, setPreviewVars] = useState<TemplateVar[]>([]);
  const [previewRendered, setPreviewRendered] = useState('');

  useEffect(() => {
    if (visible && plugin) {
      setSelectedProject('');
      
      // 获取插件默认配置
      if (plugin.plugin_type === 'binary') {
        setConfigContent('');
        if (plugin.is_config) {
          // 有配置模板的二进制插件：从后端加载 config_template
          setConfigTemplate('');
          getPluginDetail(plugin.id)
            .then(res => {
              const d = res.data as any;
              if (d?.config_template) {
                setConfigTemplate(d.config_template);
              }
            })
            .catch(() => { /* ignore */ });
        } else {
          setConfigTemplate('');
        }
        setEnableConfig(true);
      } else {
        const defaultConfig = getPluginDefaultConfig(plugin.name);
        if (defaultConfig.length > 0) {
          setEnableConfig(true);
          setConfigList(defaultConfig.map(item => ({ ...item })));
        } else {
          setEnableConfig(false);
          setConfigList([]);
        }
      }
    }
  }, [visible, plugin]);

  // ESC 键关闭抽屉
  useEffect(() => {
    if (!visible) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose]);

  const handleAddConfig = () => setConfigList(prev => [...prev, { key: '', value: '' }]);
  const handleRemoveConfig = (index: number) => setConfigList(prev => prev.filter((_, i) => i !== index));
  const handleConfigChange = (index: number, field: 'key' | 'value', value: string) => {
    setConfigList(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // 构建配置对象
  const buildConfig = (): Record<string, string> | undefined => {
    if (!enableConfig || configList.length === 0) return undefined;
    
    const config: Record<string, string> = {};
    configList.forEach(item => {
      if (item.key && item.value) config[item.key] = item.value;
    });
    return Object.keys(config).length > 0 ? config : undefined;
  };

  // 执行安装（实际发送请求）
  const performInstall = async (configContentOverride?: string) => {
    if (!plugin) return;

    setLoading(true);
    try {
      let res;
      if (plugin.plugin_type === 'container') {
        const data: ContainerInstallRequest = {
          plugin_id: plugin.id,
          project: selectedProject,
        };
        const config = buildConfig();
        if (config) data.config = config;
        res = await installContainerPlugin(data);
      } else {
        const data: BinaryInstallRequest = {
          plugin_id: plugin.id,
          project: selectedProject,
        };
        const content = configContentOverride ?? configContent;
        if (content?.trim()) data.config_content = content;
        res = await installBinaryPlugin(data);
      }

      if (res.code === 200) { 
        onSuccess();
      } else { 
        toast.error(res.message || '安装失败'); 
      }
    } catch (error: unknown) { 
      const errorMsg = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'details' in error)
          ? String((error as { details: unknown }).details)
          : String(error);
      toast.error(errorMsg || '安装失败'); 
    } finally { 
      setLoading(false); 
    }
  };

  // 点击安装按钮
  const handleInstall = async () => {
    if (!plugin) return;
    if (!selectedProject) { toast.error('请选择项目'); return; }

    // 验证容器插件键值对配置
    if (plugin.plugin_type === 'container' && enableConfig && configList.length > 0) {
      const hasEmptyConfig = configList.some(v => !v.key || !v.value);
      if (hasEmptyConfig) {
        toast.warning('请填写完整的配置信息或删除空配置');
        return;
      }
    }

    // 二进制插件：检查是否存在配置模板
    if (plugin.plugin_type === 'binary' && plugin.is_config) {
      let template = configTemplate;

      // 预加载可能失败，安装前重新获取
      if (!template) {
        try {
          const res = await getPluginDetail(plugin.id);
          const d = res.data as any;
          if (d?.config_template) {
            template = d.config_template;
            setConfigTemplate(template);
          }
        } catch { /* ignore */ }
      }

      if (template) {
        const variables = parseConfigTemplate(template);

        if (variables.length > 0) {
          setPreviewVars(variables);
          setPreviewRendered(template);
          setPreviewVisible(true);
          return;
        }
        // 模板没有变量，直接安装
        await performInstall(template);
        return;
      }
    }

    // 其他情况直接安装
    await performInstall();
  };

  // 前端实时渲染预览
  const updatePreview = useCallback(() => {
    if (!configTemplate) return;
    setPreviewRendered(renderConfigTemplate(configTemplate, previewVars));
  }, [previewVars, configTemplate]);

  // 变量变化时更新预览
  useEffect(() => {
    if (!previewVisible) return;
    const timer = setTimeout(updatePreview, 300);
    return () => clearTimeout(timer);
  }, [previewVars, previewVisible, updatePreview]);

  // 预览确认后安装
  const handleConfirmPreviewInstall = async () => {
    // 校验单变量是否填完（注释含"留空""可选""optional"的字段不强制）
    const isOptional = (desc: string) => /留空|可选|optional|二选一/i.test(desc);
    const hasEmptySimple = previewVars.some(v => v.type === 'simple' && !v.value && !isOptional(v.description));
    if (hasEmptySimple) { toast.warning('请填写完整的变量值'); return; }
    const rendered = renderConfigTemplate(configTemplate, previewVars);
    setPreviewVisible(false);
    await performInstall(rendered);
  };

  // 单变量值变化
  const handleSimpleVarChange = (index: number, value: string) => {
    setPreviewVars(prev => prev.map((v, i) => i === index ? { ...v, value } as SimpleVar : v));
  };

  // 数组项字段变化
  const handleArrayFieldChange = (varIndex: number, itemIndex: number, field: string, value: string) => {
    setPreviewVars(prev => prev.map((v, i) => {
      if (i !== varIndex || v.type !== 'array') return v;
      const items = [...v.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      return { ...v, items };
    }));
  };

  // 添加数组项
  const handleAddArrayItem = (varIndex: number) => {
    setPreviewVars(prev => prev.map((v, i) => {
      if (i !== varIndex || v.type !== 'array') return v;
      return { ...v, items: [...v.items, createEmptyItem(v.fields)] };
    }));
  };

  // 删除数组项
  const handleRemoveArrayItem = (varIndex: number, itemIndex: number) => {
    setPreviewVars(prev => prev.map((v, i) => {
      if (i !== varIndex || v.type !== 'array') return v;
      return { ...v, items: v.items.filter((_, idx) => idx !== itemIndex) };
    }));
  };

  if (!visible) return null; 

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-container install-drawer">
        <div className="drawer-header">
          <h3>安装插件 - {plugin?.display_name}</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="plugin-info-card">
            <div className="info-row"><span className="label">插件名称:</span><span>{plugin?.name}</span></div>
            <div className="info-row"><span className="label">版本:</span><span>v{plugin?.version}</span></div>
            <div className="info-row"><span className="label">类型:</span><span>{plugin?.plugin_type === 'container' ? '容器插件' : '二进制插件'}</span></div>
          </div>

          <div className="form-item">
            <label>选择项目 <span className="required">*</span></label>
            <div className="project-cards">
              {projects.length === 0 ? (
                <div className="no-data">暂无项目，请先创建项目</div>
              ) : (
                projects.map(p => (
                  <div 
                    key={p.project} 
                    className={`project-card ${selectedProject === p.project ? 'active' : ''}`}
                    onClick={() => setSelectedProject(p.project)}
                  >
                    {selectedProject === p.project && <span className="check-icon">✓</span>}
                    <div className="project-name">{p.project_name}</div>
                    <div className="project-code">{p.project}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {plugin?.plugin_type === 'container' && (
            <>
              <div className="form-item">
                <label>添加配置</label>
                <div className="switch-row">
                  <div 
                    className={`switch-toggle ${enableConfig ? 'active' : ''}`}
                    onClick={() => setEnableConfig(!enableConfig)}
                  >
                    <div className="switch-handle" />
                  </div>
                  <span className="form-tip">开启后可配置插件参数</span>
                </div>
              </div>

              {enableConfig && (
                <div className="form-item">
                  <label>配置参数</label>
                  <div className="config-list">
                    {configList.map((item, index) => (
                      <div key={index} className="config-item">
                        <div className="config-row">
                          <input type="text" value={item.key} onChange={e => handleConfigChange(index, 'key', e.target.value)} placeholder="参数名" />
                          <span className="sep">=</span>
                          <input type="text" value={item.value} onChange={e => handleConfigChange(index, 'value', e.target.value)} placeholder={getConfigDescription(item.key)} />
                          <button className="btn-icon" onClick={() => handleRemoveConfig(index)}><Trash2 size={14} /></button>
                        </div>
                        {item.key && CONFIG_DESCRIPTIONS[item.key] && (
                          <div className="config-desc">{CONFIG_DESCRIPTIONS[item.key]}</div>
                        )}
                      </div>
                    ))}
                    <button className="btn-add" onClick={handleAddConfig}><Plus size={14} /> 添加配置</button>
                  </div>
                </div>
              )}
            </>
          )}

          {plugin?.plugin_type === 'binary' && (
            <>
              {configTemplate ? (
                <div className="form-item">
                  <label>配置文件</label>
                  <div className="config-file-tip">
                    该插件包含配置模板，点击“确认安装”后将弹出变量填写框。
                  </div>
                </div>
              ) : configContent ? (
                <div className="form-item">
                  <label>配置文件</label>
                  <div className="config-file-tip">编辑 YAML 配置文件，安装时将写入插件目录</div>
                  <textarea
                    className="id-config-textarea"
                    value={configContent}
                    onChange={e => setConfigContent(e.target.value)}
                    rows={18}
                    spellCheck={false}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="drawer-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleInstall} disabled={loading}>
            {loading && <Loader2 size={14} className="spin" />} 确认安装
          </button>
        </div>
      </div>

      {/* 配置变量预览弹框 */}
      {previewVisible && (
        <>
          <div className="modal-overlay" onClick={() => setPreviewVisible(false)} style={{ zIndex: 1200 }}>
            <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>配置预览 - {plugin?.name}</h3>
                <button className="close-btn" onClick={() => setPreviewVisible(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="pv-layout">
                  <div className="pv-left">
                    <div className="pv-label">配置变量</div>
                    <div className="pv-vars">
                      {previewVars.map((v, i) => v.type === 'simple' ? (
                        <div key={v.key} className="pv-var-row">
                          <div className="pv-var-key">
                            <span className="pv-var-name">{v.key}</span>
                            {v.description && <span className="pv-var-desc">{v.description}</span>}
                          </div>
                          <input
                            type="text"
                            value={v.value}
                            onChange={e => handleSimpleVarChange(i, e.target.value)}
                            placeholder={v.description || `请输入 ${v.key}`}
                            className="pv-var-input"
                          />
                        </div>
                      ) : (
                        <div key={v.key} className="pv-array-block">
                          <div className="pv-array-header">
                            <span className="pv-var-name">{v.key}</span>
                            {v.description && <span className="pv-var-desc">{v.description}</span>}
                            <button className="pv-btn-add" onClick={() => handleAddArrayItem(i)}><Plus size={12} /> 添加</button>
                          </div>
                          {(v as ArrayVar).items.map((item, itemIdx) => (
                            <div key={itemIdx} className="pv-array-item">
                              <div className="pv-array-item-header">
                                <span>#{itemIdx + 1}</span>
                                {(v as ArrayVar).items.length > 1 && (
                                  <button className="pv-btn-remove" onClick={() => handleRemoveArrayItem(i, itemIdx)}><Trash2 size={12} /></button>
                                )}
                              </div>
                              {(v as ArrayVar).fields.map(field => (
                                <div key={field.key} className="pv-var-row">
                                  <div className="pv-var-key">
                                    <span className="pv-var-name">{field.key}</span>
                                    {field.description && <span className="pv-var-desc">{field.description}</span>}
                                  </div>
                                  <input
                                    type="text"
                                    value={item[field.key] || ''}
                                    onChange={e => handleArrayFieldChange(i, itemIdx, field.key, e.target.value)}
                                    placeholder={field.description || `请输入 ${field.key}`}
                                    className="pv-var-input"
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pv-right">
                    <div className="pv-label">渲染预览</div>
                    <pre className="pv-preview">{previewRendered || configTemplate}</pre>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-default" onClick={() => setPreviewVisible(false)}>取消</button>
                <button className="btn-primary" onClick={handleConfirmPreviewInstall} disabled={loading}>
                  {loading && <Loader2 size={14} className="spin" />} 确认安装
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <style>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .install-drawer { position: fixed; top: 0; right: 0; width: 800px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .drawer-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .plugin-info-card { background: var(--bg-secondary); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .info-row { display: flex; gap: 8px; margin-bottom: 8px; font-size: 14px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-row .label { color: var(--text-secondary); }
        .info-row span:last-child { color: var(--text-color); }
        .form-item { margin-bottom: 16px; }
        .form-item label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-color); }
        .form-item .required { color: #ff4d4f; }
        .form-item select, .form-item input[type="text"], .form-item input[type="number"] { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .form-tip { display: block; margin-top: 4px; font-size: 12px; color: var(--text-secondary); }
        .project-cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
        .project-card { position: relative; border: 2px solid var(--border-color); border-radius: 6px; padding: 10px 8px; cursor: pointer; transition: all 0.3s; text-align: center; min-height: 70px; width: 110px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; }
        .project-card:hover { border-color: var(--primary-color); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .project-card.active { border-color: var(--primary-color); background: rgba(64, 158, 255, 0.1); }
        .project-card .check-icon { position: absolute; top: 4px; right: 4px; color: var(--primary-color); font-size: 14px; font-weight: bold; }
        .project-name { font-size: 13px; font-weight: 500; color: var(--text-color); margin-bottom: 4px; word-break: break-all; line-height: 1.4; }
        .project-code { font-size: 11px; color: var(--text-secondary); word-break: break-all; line-height: 1.3; }
        .no-data { color: var(--text-secondary); text-align: center; padding: 20px; font-size: 14px; width: 100%; }
        .switch-row { display: flex; align-items: center; gap: 12px; }
        .switch-toggle { width: 44px; height: 22px; background: var(--border-color); border-radius: 11px; cursor: pointer; position: relative; transition: background 0.3s; }
        .switch-toggle.active { background: var(--primary-color); }
        .switch-handle { width: 18px; height: 18px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .switch-toggle.active .switch-handle { left: 24px; }
        .switch-row .form-tip { margin-top: 0; }
        .config-list { display: flex; flex-direction: column; gap: 12px; }
        .config-item { display: flex; flex-direction: column; gap: 4px; }
        .config-row { display: flex; align-items: center; gap: 8px; }
        .config-row input { flex: 1; }
        .config-row .sep { color: var(--text-secondary); font-weight: bold; }
        .config-desc { padding-left: 4px; font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
        .config-file-tip { padding: 8px 12px; margin-bottom: 8px; background: rgba(64, 158, 255, 0.08); border: 1px solid rgba(64, 158, 255, 0.2); border-radius: 4px; color: var(--text-secondary); font-size: 12px; }
        .id-config-textarea { width: 100%; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; color: var(--text-color); resize: vertical; line-height: 1.6; tab-size: 2; box-sizing: border-box; }
        .id-config-textarea:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15); }
        .btn-icon { background: none; border: none; cursor: pointer; color: #ff4d4f; padding: 4px; }
        .btn-add { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px; color: var(--primary-color); }
        .btn-default, .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .btn-primary:disabled { opacity: 0.6; }
        .spin { animation: spin 1s linear infinite; }

        .pv-layout { display: flex; gap: 20px; min-height: 400px; }
        .pv-left { flex: 0 0 45%; display: flex; flex-direction: column; }
        .pv-right { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .pv-label { display: flex; align-items: center; margin-bottom: 10px; font-size: 13px; font-weight: 500; color: var(--text-color); }
        .pv-vars { display: flex; flex-direction: column; gap: 12px; overflow: auto; flex: 1; }
        .pv-var-row { display: flex; flex-direction: row; align-items: flex-start; gap: 12px; }
        .pv-var-key { display: flex; flex-direction: column; flex: 0 0 180px; min-width: 0; padding-top: 7px; }
        .pv-var-name { font-size: 13px; font-weight: 500; color: var(--text-color); font-family: 'Consolas', monospace; word-break: break-all; }
        .pv-var-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.4; }
        .pv-var-input { flex: 1; min-width: 0; padding: 7px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; }
        .pv-var-input:focus { outline: none; border-color: var(--primary-color); }
        .pv-array-block { border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; }
        .pv-array-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .pv-btn-add { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding: 4px 10px; background: var(--bg-secondary); border: 1px dashed var(--primary-color); border-radius: 4px; color: var(--primary-color); cursor: pointer; font-size: 12px; }
        .pv-btn-add:hover { background: rgba(64, 158, 255, 0.08); }
        .pv-array-item { padding: 10px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 8px; }
        .pv-array-item:last-child { margin-bottom: 0; }
        .pv-array-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--text-secondary); }
        .pv-btn-remove { background: none; border: none; cursor: pointer; color: #ff4d4f; padding: 2px; }
        .pv-btn-remove:hover { opacity: 0.7; }
        .pv-preview { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 14px; font-size: 12px; font-family: 'Consolas', 'Monaco', monospace; color: var(--text-color); line-height: 1.6; flex: 1; overflow: auto; white-space: pre-wrap; word-break: break-all; margin: 0; }
      `}</style>
    </>
  );
};

export default InstallDrawer;
