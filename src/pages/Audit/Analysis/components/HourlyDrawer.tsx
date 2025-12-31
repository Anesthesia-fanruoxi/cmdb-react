/**
 * 小时详情抽屉
 */

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getSqlHourlyUserStats, getEsHourlyUserStats } from '../../../../services/audit/audit';

interface Props {
  visible: boolean;
  type: 'sql' | 'es';
  hour: number;
  startTime: string;
  endTime: string;
  onClose: () => void;
}

interface UserStats {
  id?: number;
  user_id?: number;
  nick_name: string;
  count: number;
}

const HourlyDrawer = ({ visible, type, hour, startTime, endTime, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UserStats[]>([]);

  useEffect(() => {
    if (visible) fetchData();
  }, [visible, type, hour]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { start_time: startTime, end_time: endTime, hour };
      const res = type === 'sql' 
        ? await getSqlHourlyUserStats(params) 
        : await getEsHourlyUserStats(params);
      if (res.code === 200 && res.data) {
        const resData = res.data as { list?: UserStats[] };
        setData(resData.list || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const getTotal = () => data.reduce((sum, i) => sum + i.count, 0) || 1;

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-container hourly-drawer">
        <div className="drawer-header">
          <h3>{type.toUpperCase()} {hour}:00 - {hour}:59 用户执行统计</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="stats-table">
              <thead>
                <tr><th>用户</th><th>执行次数</th><th>占比</th></tr>
              </thead>
              <tbody>
                {data.map((item, idx) => {
                  const pct = Math.round((item.count / getTotal()) * 100);
                  return (
                    <tr key={idx}>
                      <td>{item.nick_name}</td>
                      <td>{item.count}</td>
                      <td>
                        <div className="progress-bar">
                          <div className={`progress-fill ${pct > 50 ? 'danger' : pct > 30 ? 'warning' : ''}`} style={{ width: `${pct}%` }} />
                          <span>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && <tr><td colSpan={3} className="empty">暂无数据</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <style>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .hourly-drawer { position: fixed; top: 0; right: 0; width: 600px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; height: 200px; color: var(--text-secondary); }
        .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .stats-table th, .stats-table td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color); }
        .stats-table th { background: var(--bg-secondary); font-weight: 500; color: var(--text-color); }
        .stats-table td { color: var(--text-secondary); }
        .stats-table .empty { text-align: center; padding: 40px !important; }
        .progress-bar { display: flex; align-items: center; gap: 8px; height: 16px; background: var(--bg-secondary); border-radius: 8px; overflow: hidden; position: relative; min-width: 100px; }
        .progress-fill { height: 100%; background: var(--primary-color); border-radius: 8px; }
        .progress-fill.warning { background: #faad14; }
        .progress-fill.danger { background: #ff4d4f; }
        .progress-bar span { position: absolute; right: 8px; font-size: 12px; color: var(--text-secondary); }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default HourlyDrawer;
