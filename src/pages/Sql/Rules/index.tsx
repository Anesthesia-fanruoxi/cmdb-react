/**
 * SQL规则管理页面
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getRulesList, updateRuleStatus, SQL_TAG_TYPE_MAP, type RuleItem } from '../../../services/sql/rules';
import './style.css';

const SqlRules = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 获取规则列表
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRulesList();
      if (res.code === 200) {
        setRules(res.data || []);
      }
    } catch (error) {
      console.error('获取规则列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // 统计数据
  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter(r => r.is_enabled === 1).length,
    disabled: rules.filter(r => r.is_enabled === 0).length,
    tags: [...new Set(rules.map(r => r.sql_tag))]
  }), [rules]);

  // 过滤后的规则列表
  const filteredRules = useMemo(() => {
    let list = rules;
    if (filterTag) list = list.filter(r => r.sql_tag === filterTag);
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter(r => 
        r.rule_name.toLowerCase().includes(kw) || 
        r.rule_description.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [rules, filterTag, keyword]);

  // 切换规则状态
  const handleToggle = async (rule: RuleItem) => {
    const newStatus = rule.is_enabled === 1 ? 0 : 1;
    // 乐观更新
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: newStatus } : r));
    try {
      await updateRuleStatus(rule.id, newStatus === 1);
    } catch (error) {
      // 回滚
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: rule.is_enabled } : r));
      console.error('更新规则状态失败:', error);
    }
  };

  // 获取标签数量
  const getTagCount = (tag: string) => rules.filter(r => r.sql_tag === tag).length;

  // 格式化规则内容
  const formatContent = (content: string) => {
    try {
      const obj = typeof content === 'string' ? JSON.parse(content) : content;
      return JSON.stringify(obj, null, 2);
    } catch {
      return content;
    }
  };

  return (
    <div className="sql-rules">
      {/* 统计卡片 */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon total">📋</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">总规则数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon enabled">✓</div>
          <div className="stat-info">
            <div className="stat-value">{stats.enabled}</div>
            <div className="stat-label">已启用</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon disabled">✗</div>
          <div className="stat-info">
            <div className="stat-value">{stats.disabled}</div>
            <div className="stat-label">已禁用</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon types">⊞</div>
          <div className="stat-info">
            <div className="stat-value">{stats.tags.length}</div>
            <div className="stat-label">SQL类型</div>
          </div>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="filter-bar">
        <div className="filter-tags">
          <span 
            className={`filter-tag ${filterTag === '' ? 'active' : ''}`}
            onClick={() => setFilterTag('')}
          >
            全部 ({stats.total})
          </span>
          {stats.tags.map(tag => (
            <span 
              key={tag}
              className={`filter-tag ${filterTag === tag ? 'active' : ''} tag-${SQL_TAG_TYPE_MAP[tag] || 'default'}`}
              onClick={() => setFilterTag(tag)}
            >
              {tag} ({getTagCount(tag)})
            </span>
          ))}
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="搜索规则名称或描述..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
      </div>

      {/* 规则表格 */}
      <div className="table-container">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th style={{ width: 50 }}>ID</th>
                <th style={{ minWidth: 160 }}>规则名称</th>
                <th style={{ width: 100 }}>SQL类型</th>
                <th style={{ width: 80 }}>分类</th>
                <th>规则描述</th>
                <th style={{ minWidth: 180 }}>错误提示</th>
                <th style={{ width: 70 }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr><td colSpan={8} className="empty-cell">暂无数据</td></tr>
              ) : (
                filteredRules.map(rule => (
                  <>
                    <tr key={rule.id} className={expandedId === rule.id ? 'expanded' : ''}>
                      <td>
                        <span 
                          className="expand-btn"
                          onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                        >
                          {expandedId === rule.id ? '▼' : '▶'}
                        </span>
                      </td>
                      <td>{rule.id}</td>
                      <td className="rule-name">{rule.rule_name}</td>
                      <td>
                        <span className={`tag tag-${SQL_TAG_TYPE_MAP[rule.sql_tag] || 'default'}`}>
                          {rule.sql_tag}
                        </span>
                      </td>
                      <td>
                        <span className={`tag tag-${rule.rule_category === 'security' ? 'danger' : 'warning'}`}>
                          {rule.rule_category === 'security' ? '安全' : '规范'}
                        </span>
                      </td>
                      <td className="desc-cell">{rule.rule_description}</td>
                      <td className="error-cell">{rule.error_message}</td>
                      <td>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={rule.is_enabled === 1}
                            onChange={() => handleToggle(rule)}
                          />
                          <span className="slider"></span>
                        </label>
                      </td>
                    </tr>
                    {expandedId === rule.id && (
                      <tr key={`${rule.id}-detail`} className="detail-row">
                        <td colSpan={8}>
                          <div className="rule-detail">
                            <div className="detail-section">
                              <h4>规则详情</h4>
                              <div className="detail-grid">
                                <div><span>规则ID:</span> {rule.id}</div>
                                <div><span>规则名称:</span> {rule.rule_name}</div>
                                <div><span>规则类型:</span> {rule.rule_type}</div>
                                <div><span>SQL标签:</span> {rule.sql_tag}</div>
                              </div>
                            </div>
                            <div className="detail-section">
                              <h4>规则内容</h4>
                              <pre className="rule-content">{formatContent(rule.rule_content)}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SqlRules;
