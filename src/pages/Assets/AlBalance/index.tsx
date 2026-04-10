/**
 * 阿里云账号余额页面
 */

import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, X } from 'lucide-react';
import {
  getAlBalance,
  getAlBalanceProjects,
  getAlBalanceConfig,
  updateAlBalanceConfig,
} from '../../../services/assets/alBalance';
import type { BalanceItem, ProjectItem } from '../../../services/assets/alBalance';
import toast from '../../../components/Toast';
import EcsListModal from './EcsListModal';
import './index.css';

const AlBalancePage = () => {
  const [loading, setLoading] = useState(false);
  const [balanceList, setBalanceList] = useState<BalanceItem[]>([]);

  // 设置弹窗
  const [settingVisible, setSettingVisible] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectItem[]>([]);
  const [settingSelected, setSettingSelected] = useState<string[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);

  // ECS 弹框
  const [ecsVisible, setEcsVisible] = useState(false);
  const [ecsProject, setEcsProject] = useState('');
  const [ecsProjectName, setEcsProjectName] = useState('');

  const openEcsModal = (item: BalanceItem) => {
    setEcsProject(item.project);
    setEcsProjectName(item.project_name || item.project);
    setEcsVisible(true);
  };

  // 根据金额返回颜色 class
  const getAmountClass = (amountStr?: string) => {
    if (!amountStr) return '';
    const num = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(num)) return '';
    if (num >= 10000) return 'amount-dark-green';
    if (num >= 5000) return 'amount-light-green';
    if (num >= 2000) return 'amount-blue';
    return 'amount-red';
  };

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    let projects: ProjectItem[] = [];
    try {
      const res = await getAlBalanceProjects();
      if (res.code === 200) {
        projects = res.data || [];
        setAllProjects(projects);
      }
    } catch (e) {
      console.error('[alBalance] 获取项目列表失败:', e);
    }
    fetchBalance(projects);
  };

  const fetchBalance = async (projects?: ProjectItem[]) => {
    setLoading(true);
    try {
      const res = await getAlBalance();
      if (res.code === 200 && Array.isArray(res.data)) {
        const projectMap = (projects ?? allProjects).reduce<Record<string, string>>((acc, p) => {
          acc[p.project] = p.project_name;
          return acc;
        }, {});
        setBalanceList(res.data.map(item => ({
          ...item,
          project_name: projectMap[item.project] || item.project_name || item.project,
        })));
      } else {
        setBalanceList([]);
      }
    } catch {
      setBalanceList([]);
    } finally {
      setLoading(false);
    }
  };

  const openSetting = async () => {
    setSettingVisible(true);
    try {
      console.log('[alBalance] 请求项目列表: GET /assets/alBalance/projects');
      const projectsRes = await getAlBalanceProjects();
      console.log('[alBalance] 项目列表返回:', projectsRes);
      if (projectsRes.code === 200) setAllProjects(projectsRes.data || []);
    } catch (e) {
      console.error('[alBalance] 获取项目列表失败:', e);
      toast.error('获取项目列表失败');
    }
    try {
      console.log('[alBalance] 请求已配置项目: GET /assets/alBalance/config/list');
      const configRes = await getAlBalanceConfig();
      console.log('[alBalance] 已配置项目返回:', configRes);
      if (configRes.code === 200) setSettingSelected(configRes.data || []);
    } catch (e) {
      console.warn('[alBalance] 获取配置失败(静默):', e);
    }
  };
  const saveConfig = async () => {
    setSaveLoading(true);
    try {
      const res = await updateAlBalanceConfig(settingSelected);
      if (res.code === 200) {
        toast.success('配置已保存');
        setSettingVisible(false);
        fetchBalance(allProjects);
      } else {
        toast.error(res.message || '保存失败');
      }
    } catch {
      toast.error('保存配置失败');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="al-balance-page">
      {/* 顶部操作栏 */}
      <div className="al-balance-toolbar">
        <span className="al-balance-title">阿里云账号余额</span>
        <div className="al-balance-actions">
          <button className="btn btn-default" onClick={() => fetchBalance()} disabled={loading} title="刷新余额">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
          </button>
          <button className="btn btn-default" onClick={openSetting} title="配置项目">
            ⚙ 配置
          </button>
        </div>
      </div>

      {/* 余额卡片 */}
      {balanceList.length > 0 ? (
        <div className="balance-card-grid">
          {balanceList.map(item => (
            <div key={item.project} className="balance-card clickable" onClick={() => !item.error && openEcsModal(item)} title={item.error ? '' : '点击查看 ECS 实例'}>
              <div className="balance-card-header">
                <span className="balance-card-title" title={item.project_name || item.project}>
                  {item.project_name || item.project}
                </span>
                <span className={`balance-status-tag ${item.error ? 'error' : 'success'}`}>
                  {item.error ? '异常' : '正常'}
                </span>
              </div>
              {item.error ? (
                <div className="balance-card-error">
                  <AlertCircle size={14} />
                  <span>{item.error}</span>
                </div>
              ) : (
                <div className="balance-card-body">
                  <div className="balance-main-row">
                    <span className="balance-label">可用余额</span>
                    <span className={`balance-amount-value ${getAmountClass(item.data?.available_amount)}`}>
                      ¥ {item.data?.available_amount}
                    </span>
                  </div>
                  <div className="balance-row">
                    <span className="balance-label">现金余额</span>
                    <span>¥ {item.data?.available_cash_amount}</span>
                  </div>
                  <div className="balance-row">
                    <span className="balance-label">信用额度</span>
                    <span>¥ {item.data?.credit_amount}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="al-balance-empty">
          <AlertCircle size={40} strokeWidth={1} />
          <span>暂无数据，请先配置项目</span>
        </div>
      )}

      {/* ECS 实例弹框 */}
      <EcsListModal
        visible={ecsVisible}
        project={ecsProject}
        projectName={ecsProjectName}
        onClose={() => setEcsVisible(false)}
      />

      {/* 设置弹窗 */}
      {settingVisible && (
        <div className="setting-modal-overlay" onClick={() => setSettingVisible(false)}>
          <div className="setting-modal" onClick={e => e.stopPropagation()}>
            <div className="setting-modal-header">
              <span>配置展示项目</span>
              <button className="setting-modal-close" onClick={() => setSettingVisible(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="setting-modal-body">
              <div className="setting-tip">选择需要展示余额的项目：</div>
              <div className="setting-project-list">
                {allProjects.map(item => {
                  const checked = settingSelected.includes(item.project);
                  return (
                    <label
                      key={item.project}
                      className={`setting-checkbox-item ${checked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSettingSelected(prev =>
                            prev.includes(item.project)
                              ? prev.filter(p => p !== item.project)
                              : [...prev, item.project]
                          );
                        }}
                      />
                      <span>{item.project_name || item.project}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="setting-modal-footer">
              <button className="btn" onClick={() => setSettingVisible(false)}>取消</button>
              <button className="btn btn-primary" onClick={saveConfig} disabled={saveLoading}>
                {saveLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlBalancePage;
