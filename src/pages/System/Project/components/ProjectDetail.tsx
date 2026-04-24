/**
 * 项目详情弹窗
 */

import type { Project } from '@/services/system/project';
import './ProjectDetail.css';

interface Props {
  visible: boolean;
  data: Project | null;
  onClose: () => void;
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
};

const ProjectDetail = ({ visible, data, onClose }: Props) => {
  if (!visible || !data) return null;

  const rows: { label: string; value: string; span?: boolean }[] = [
    { label: '项目简称', value: data.project },
    { label: '项目名称', value: data.project_name },
    { label: 'Agent代理地址', value: data.agent_url || '-', span: true },
    { label: '出口IP', value: data.eip || '-' },
    { label: '后台管理地址', value: data.backen_domain || '-', span: true },
    { label: '三方调用地址', value: data.api_domain || '-', span: true },
    { label: '前端Git仓库', value: data.git_vue || '-', span: true },
    { label: '后端Git仓库', value: data.git_backend || '-', span: true },
    { label: '飞书告警地址', value: data.alter_feishu || '-', span: true },
    { label: '发版通知地址', value: data.update_feishu || '-', span: true },
    { label: '步骤通知地址', value: data.notify_feishu || '-', span: true },
    { label: '前端工具', value: data.frontend_tool || '-' },
    { label: '后端工具', value: data.backend_tool || '-' },
    { label: '链路追踪', value: data.enable_skywalking ? '已开启' : '未开启' },
    { label: '创建时间', value: formatDateTime(data.created_at) },
    { label: '更新时间', value: formatDateTime((data as Project & { updated_at?: string }).updated_at) },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content project-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>项目详情</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {data.logo && (
            <div className="detail-logo">
              <img src={data.logo} alt={data.project_name} />
            </div>
          )}
          <table className="detail-table">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={row.span ? 'span-row' : ''}>
                  <th>{row.label}</th>
                  <td colSpan={row.span ? 3 : 1} title={row.value}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
