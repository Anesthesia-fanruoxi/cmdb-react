/**
 * ECS 实例列表弹框
 */

import { useState, useEffect } from 'react';
import { X, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getAlBalanceEcsList } from '../../../services/assets/alBalance';
import type { EcsItem, EcsInstance } from '../../../services/assets/alBalance';
import toast from '../../../components/Toast';
import './EcsListModal.css';

interface Props {
  visible: boolean;
  project: string;
  projectName: string;
  onClose: () => void;
}

const formatExpiredTime = (time: string) => {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/\//g, '-');
};

const isExpiringSoon = (time: string) => {
  if (!time) return false;
  const diff = new Date(time).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
};

type RemainingStatus = 'expired' | 'danger' | 'warning' | 'blue' | 'normal' | 'none';

const formatRemainingTime = (time: string): { text: string; status: RemainingStatus } => {
  if (!time) return { text: '-', status: 'none' };
  const diff = new Date(time).getTime() - Date.now();
  if (diff <= 0) return { text: '已过期', status: 'expired' };
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const text = days === 0 ? `${hours} 小时` : `${days} 天`;
  if (days < 7) return { text, status: 'danger' };
  if (days < 15) return { text, status: 'warning' };
  if (days < 30) return { text, status: 'blue' };
  return { text, status: 'normal' };
};

const EcsListModal = ({ visible, project, projectName, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<EcsItem[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (visible) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const instances: EcsInstance[] = allData.find(d => d.project === project)?.data?.instances || [];
  const total = allData.find(d => d.project === project)?.data?.total ?? instances.length;

  const sortedInstances = sortOrder === null ? instances : [...instances].sort((a, b) => {
    const getMs = (t: string) => t ? new Date(t).getTime() : Infinity;
    const diff = getMs(a.expired_time) - getMs(b.expired_time);
    return sortOrder === 'asc' ? diff : -diff;
  });

  const toggleSort = () => {
    setSortOrder(prev => prev === null ? 'asc' : prev === 'asc' ? 'desc' : null);
  };

  useEffect(() => {
    if (!visible) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await getAlBalanceEcsList();
        if (res.code === 200 && Array.isArray(res.data)) {
          setAllData(res.data);
        } else {
          setAllData([]);
          toast.error(res.message || '获取 ECS 列表失败');
        }
      } catch {
        setAllData([]);
        toast.error('获取 ECS 列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="ecs-modal-overlay" onClick={onClose}>
      <div className="ecs-modal" onClick={e => e.stopPropagation()}>
        <div className="ecs-modal-header">
          <span>ECS 实例列表 - {projectName}</span>
          <button className="ecs-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="ecs-modal-body">
          {loading ? (
            <div className="ecs-loading"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : instances.length === 0 ? (
            <div className="ecs-empty">暂无 ECS 实例数据</div>
          ) : (
            <>
              <div className="ecs-summary">共 <strong>{total}</strong> 台实例</div>
              <div className="ecs-table-wrap">
                <table className="ecs-table">
                  <thead>
                    <tr>
                      <th>实例名称</th>
                      <th>实例 ID</th>
                      <th>规格</th>
                      <th>地域</th>
                      <th>计费方式</th>
                      <th>状态</th>
                      <th>到期时间</th>
                      <th className="ecs-th-sortable" onClick={toggleSort}>
                        剩余时间
                        {sortOrder === null && <ArrowUpDown size={12} />}
                        {sortOrder === 'asc' && <ArrowUp size={12} />}
                        {sortOrder === 'desc' && <ArrowDown size={12} />}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInstances.map(ins => (
                      <tr key={ins.instance_id}>
                        <td title={ins.instance_name}>{ins.instance_name}</td>
                        <td className="ecs-id" title={ins.instance_id}>{ins.instance_id}</td>
                        <td title={ins.instance_type}>{ins.instance_type}</td>
                        <td>{ins.region_id}</td>
                        <td>
                          <span className={`ecs-tag ${ins.charge_type === 'PrePaid' ? 'tag-warning' : 'tag-info'}`}>
                            {ins.charge_type === 'PrePaid' ? '包年包月' : '按量付费'}
                          </span>
                        </td>
                        <td>
                          <span className={`ecs-tag ${ins.status === 'Running' ? 'tag-success' : 'tag-danger'}`}>
                            {ins.status === 'Running' ? '运行中' : ins.status}
                          </span>
                        </td>
                        <td className={isExpiringSoon(ins.expired_time) ? 'text-warning' : ''}>
                          {formatExpiredTime(ins.expired_time)}
                        </td>
                        <td>
                          {(() => {
                            const { text, status } = formatRemainingTime(ins.expired_time);
                            if (status === 'none') return <span>-</span>;
                            const cls =
                              status === 'expired' || status === 'danger' ? 'ecs-tag tag-danger' :
                              status === 'warning' ? 'ecs-tag tag-warning' :
                              status === 'blue' ? 'ecs-tag tag-info' :
                              'ecs-tag tag-success';
                            return <span className={cls}>{text}</span>;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="ecs-modal-footer">
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default EcsListModal;
