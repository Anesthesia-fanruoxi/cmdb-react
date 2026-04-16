/**
 * 安全组管理页面 - 入站规则增删改查
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Edit2, Trash2, ShieldCheck, Search } from 'lucide-react';
import {
  getSecurityGroupList,
  deleteSecurityGroupRule,
} from '@/services/assets/securityGroup';
import type { SecurityGroupInfo, SecurityGroupRule } from '@/services/assets/securityGroup';
import toast from '@/components/Toast';
import { useAuthStore } from '@/stores/authStore';
import RuleFormModal from './RuleFormModal';
import './index.css';

const SecurityGroupPage = () => {
  const [loading, setLoading] = useState(false);
  const [sgInfo, setSgInfo] = useState<SecurityGroupInfo | null>(null);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editRule, setEditRule] = useState<SecurityGroupRule | null>(null);

  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 搜索关键词
  const [keyword, setKeyword] = useState('');

  // 屏蔽开关（仅管理员可用）：过滤掉备注为「自动更新 - IP监控工具」的规则
  const MONITOR_DESC = '自动更新 - IP监控工具';
  const [hideMonitor, setHideMonitor] = useState(false);

  // 角色判断：role_id 为 1 或 2 时为管理员
  const user = useAuthStore(s => s.user);
  const roleId = user?.role_id ? Number(user.role_id) : 0;
  const isAdmin = roleId === 1 || roleId === 2;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getSecurityGroupList();
      if (res.code === 200) {
        setSgInfo(res.data);
      } else {
        toast.error(res.message || '获取安全组信息失败');
      }
    } catch {
      toast.error('获取安全组信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditRule(null);
    setModalVisible(true);
  };

  const handleEdit = (rule: SecurityGroupRule) => {
    setEditRule(rule);
    setModalVisible(true);
  };

  const handleDelete = async (rule: SecurityGroupRule) => {
    console.log('[SecurityGroup] 删除规则数据:', rule);
    if (!rule.security_group_rule_id) {
      toast.error('该规则缺少 rule_id，无法删除');
      return;
    }
    setDeletingId(rule.security_group_rule_id);
    try {
      const res = await deleteSecurityGroupRule({
        security_group_rule_id: rule.security_group_rule_id,
      });
      if (res.code === 200) {
        toast.success('规则已删除');
        fetchData();
      } else {
        toast.error(res.message || '删除失败');
      }
    } catch (e) {
      console.error('[SecurityGroup] 删除失败:', e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || '删除失败，请稍后重试');
    } finally {
      setDeletingId(null);
    }
  };

  const getPolicyTag = (policy: string) => {
    return policy?.toLowerCase() === 'accept'
      ? <span className="sg-tag tag-accept">允许</span>
      : <span className="sg-tag tag-drop">拒绝</span>;
  };

  const getProtocolTag = (protocol: string) => {
    const key = protocol?.toLowerCase() || '';
    const colorMap: Record<string, string> = {
      tcp: 'tag-tcp',
      udp: 'tag-udp',
      icmp: 'tag-icmp',
      all: 'tag-all',
    };
    return (
      <span className={`sg-tag ${colorMap[key] || 'tag-all'}`}>
        {key.toUpperCase()}
      </span>
    );
  };

  const rules = sgInfo?.ingress_rules ?? [];

  // 普通用户只能操作端口为 80 或 443 的规则
  const isAllowedPort = (portRange: string) => {
    return portRange === '80/80' || portRange === '443/443';
  };

  // 前端过滤：屏蔽开关 + 关键词搜索
  const baseRules = (isAdmin && hideMonitor)
    ? rules.filter(r => r.description !== MONITOR_DESC)
    : rules;

  const filteredRules = keyword.trim()
    ? baseRules.filter(r => {
        const kw = keyword.trim().toLowerCase();
        return (
          r.ip_protocol?.toLowerCase().includes(kw) ||
          r.port_range?.toLowerCase().includes(kw) ||
          r.source_cidr_ip?.toLowerCase().includes(kw) ||
          r.description?.toLowerCase().includes(kw) ||
          r.policy?.toLowerCase().includes(kw)
        );
      })
    : baseRules;

  return (
    <div className="sg-page">
      {/* 顶部信息栏 */}
      {sgInfo && (
        <div className="sg-info-bar">
          <ShieldCheck size={16} className="sg-info-icon" />
          <span className="sg-info-item">
            <span className="sg-info-label">安全组：</span>
            {sgInfo.security_group_name}
            <span className="sg-info-id">（{sgInfo.security_group_id}）</span>
          </span>
          <span className="sg-info-sep">|</span>
          <span className="sg-info-item">
            <span className="sg-info-label">地域：</span>
            {sgInfo.region_id}
          </span>
          <span className="sg-info-sep">|</span>
          <span className="sg-info-item">
            <span className="sg-info-label">VPC：</span>
            {sgInfo.vpc_id}
          </span>
        </div>
      )}

      {/* 操作栏 */}
      <div className="sg-toolbar">
        <span className="sg-toolbar-title">
          入站规则
          {rules.length > 0 && (
            <span className="sg-count">
              {(keyword.trim() || (isAdmin && hideMonitor))
                ? `${filteredRules.length} / ${rules.length}`
                : rules.length}
            </span>
          )}
        </span>
        <div className="sg-toolbar-actions">
          <div className="sg-search-wrap">
            <Search size={14} className="sg-search-icon" />
            <input
              className="sg-search-input"
              placeholder="搜索协议、端口、IP、描述..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
            {keyword && (
              <button className="sg-search-clear" onClick={() => setKeyword('')}>×</button>
            )}
          </div>
          {isAdmin && (
            <button
              className={`btn btn-default sg-btn-shield ${hideMonitor ? 'active' : ''}`}
              onClick={() => setHideMonitor(v => !v)}
              title={hideMonitor ? '已屏蔽自动更新规则，点击取消' : '点击屏蔽自动更新规则'}
            >
              <ShieldCheck size={14} />
              {hideMonitor ? '已屏蔽自动更新' : '屏蔽自动更新'}
            </button>
          )}
          <button className="btn btn-default" onClick={fetchData} disabled={loading} title="刷新">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            刷新
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={14} />
            新增规则
          </button>
        </div>
      </div>

      {/* 规则表格 */}
      <div className="sg-table-wrap">
        {loading && rules.length === 0 ? (
          <div className="sg-loading">
            <RefreshCw size={18} className="spin" />
            <span>加载中...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="sg-empty">
            <ShieldCheck size={40} strokeWidth={1} />
            <span>{keyword.trim() ? '没有匹配的规则' : '暂无入站规则'}</span>
          </div>
        ) : (
          <table className="sg-table">
            <thead>
              <tr>
                <th>协议</th>
                <th>端口范围</th>
                <th>源 IP 段</th>
                <th>策略</th>
                <th>优先级</th>
                <th>描述</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule, idx) => (
                <tr key={rule.security_group_rule_id || idx}>
                  <td>{getProtocolTag(rule.ip_protocol)}</td>
                  <td className="sg-mono">{rule.port_range}</td>
                  <td className="sg-mono">{rule.source_cidr_ip || '-'}</td>
                  <td>{getPolicyTag(rule.policy)}</td>
                  <td>{rule.priority}</td>
                  <td className="sg-desc" title={rule.description}>{rule.description || '-'}</td>
                  <td className="sg-time">
                    {rule.create_time
                      ? new Date(rule.create_time).toLocaleString('zh-CN', { hour12: false })
                      : '-'}
                  </td>
                  <td>
                    <div className="sg-actions">
                      {(isAdmin || isAllowedPort(rule.port_range)) ? (
                        <>
                          <button
                            className="sg-btn-action"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit2 size={13} />
                            编辑
                          </button>
                          <button
                            className="sg-btn-action sg-btn-action-danger"
                            disabled={deletingId === rule.security_group_rule_id}
                            onClick={() => handleDelete(rule)}
                          >
                            <Trash2 size={13} />
                            {deletingId === rule.security_group_rule_id ? '删除中...' : '删除'}
                          </button>
                        </>
                      ) : (
                        <span className="sg-no-action">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      <RuleFormModal
        visible={modalVisible}
        editRule={editRule}
        isAdmin={isAdmin}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default SecurityGroupPage;
