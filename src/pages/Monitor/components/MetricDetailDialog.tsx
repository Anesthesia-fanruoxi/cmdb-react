/**
 * 指标详情弹窗组件
 */

import { X, Download } from 'lucide-react';
import type { MonitorMetric } from '../../../services/monitor';
import { formatValue, formatTimestamp } from '../utils/format';
import { convertToChartSeries, getChartColor } from '../utils/chart';
import './MetricDetailDialog.css';

interface MetricDetailDialogProps {
  visible: boolean;
  metric: MonitorMetric | null;
  onClose: () => void;
}

const MetricDetailDialog = ({ visible, metric, onClose }: MetricDetailDialogProps) => {
  if (!visible || !metric) return null;

  const standard = (metric.standard || 'default') as any;
  const series = convertToChartSeries(metric, standard);

  // 获取表格数据
  const tableData = series.map(s => {
    const values = s.data.map(d => d.value);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const latest = values.length > 0 ? values[values.length - 1] : 0;
    
    return { name: s.name, avg, max, min, latest, color: s.color };
  });

  // 导出数据
  const handleExport = () => {
    const headers = ['名称', '最新值', '平均值', '最大值', '最小值'];
    const rows = tableData.map(d => [
      d.name,
      formatValue(d.latest, standard),
      formatValue(d.avg, standard),
      formatValue(d.max, standard),
      formatValue(d.min, standard),
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metric.view_name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="metric-detail-overlay" onClick={onClose}>
      <div className="metric-detail-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{metric.view_name}</h3>
          <div className="header-actions">
            <button className="btn-icon" onClick={handleExport} title="导出数据">
              <Download size={16} />
            </button>
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="dialog-body">
          <div className="detail-info">
            <div className="info-item">
              <span className="label">查询语句:</span>
              <code className="value">{metric.query}</code>
            </div>
            <div className="info-item">
              <span className="label">更新时间:</span>
              <span className="value">{formatTimestamp(metric.updated_at)}</span>
            </div>
            <div className="info-item">
              <span className="label">数据点数:</span>
              <span className="value">{metric.hosts_count || 0}</span>
            </div>
          </div>
          
          <div className="detail-table">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>最新值</th>
                  <th>平均值</th>
                  <th>最大值</th>
                  <th>最小值</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span className="name-cell">
                        <span
                          className="color-dot"
                          style={{ backgroundColor: row.color || getChartColor(i) }}
                        />
                        {row.name}
                      </span>
                    </td>
                    <td>{formatValue(row.latest, standard)}</td>
                    <td>{formatValue(row.avg, standard)}</td>
                    <td>{formatValue(row.max, standard)}</td>
                    <td>{formatValue(row.min, standard)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricDetailDialog;
