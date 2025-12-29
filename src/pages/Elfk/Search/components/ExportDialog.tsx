/**
 * 导出字段选择对话框
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, X, CheckSquare, Square } from 'lucide-react';
import { getToken } from '../../../../utils/storage';
import toast from '../../../../components/Toast';
import type { ViewDetail } from '../../../../services/elfk/view';
import '../styles/export-dialog.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const isTauriEnv = () => typeof window !== 'undefined' && '__TAURI__' in window;

interface Props {
  visible: boolean;
  currentView: ViewDetail | null;
  searchParams?: Record<string, unknown>;
  onClose: () => void;
  onSuccess: (filePath: string) => void;
}

interface FieldItem {
  path: string;
  name: string;
  type: string;
}

// 从 all_field 提取字段列表
const extractFields = (view: ViewDetail | null): FieldItem[] => {
  if (!view?.all_field?.properties) return [];
  return Object.entries(view.all_field.properties).map(([key, info]) => ({
    path: key,
    name: key,
    type: info.type || 'string'
  }));
};

const ExportDialog = ({ visible, currentView, searchParams, onClose, onSuccess }: Props) => {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 可用字段列表
  const availableFields = extractFields(currentView);

  // 打开时默认选择常用字段
  useEffect(() => {
    if (visible && availableFields.length > 0) {
      const commonFields = ['@timestamp', 'message', 'level', 'logger', 'thread', 'host', 'service', 'content'];
      const defaults = availableFields
        .filter(f => commonFields.some(c => f.path.toLowerCase().includes(c)))
        .map(f => f.path)
        .slice(0, 15);
      setSelectedFields(defaults.length > 0 ? defaults : availableFields.slice(0, 10).map(f => f.path));
    }
  }, [visible, currentView]);

  const handleSelectAll = () => setSelectedFields(availableFields.map(f => f.path));
  const handleDeselectAll = () => setSelectedFields([]);

  const toggleField = (path: string) => {
    setSelectedFields(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) return;
    if (!isTauriEnv()) {
      toast.warning('导出功能仅支持桌面客户端');
      return;
    }
    const token = getToken();
    if (!token) {
      toast.warning('请先登录');
      return;
    }

    setLoading(true);
    try {
      const filePath = await invoke<string>('export_elfk_logs', {
        apiBase: API_BASE,
        token,
        params: {
          project: searchParams?.project,
          index_pattern: searchParams?.index_pattern,
          start_time: searchParams?.start_time,
          end_time: searchParams?.end_time,
          time_field: searchParams?.time_field,
          keyword: searchParams?.keyword || '',
          view_name: currentView?.name || 'logs',
          use_field_filter: true,
          include_fields: selectedFields,
        }
      });
      onSuccess(filePath);
      onClose();
    } catch (err) {
      console.error('导出失败:', err);
      toast.error(`导出失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={e => e.stopPropagation()}>
        <div className="export-dialog-header">
          <span className="title">选择导出字段</span>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="export-dialog-body">
          <div className="field-actions">
            <button onClick={handleSelectAll}>全选</button>
            <button onClick={handleDeselectAll}>清空</button>
            <span className="selected-count">已选择 {selectedFields.length} 个字段</span>
          </div>

          {availableFields.length === 0 ? (
            <div className="empty-tip">没有可用字段</div>
          ) : (
            <div className="fields-list">
              {availableFields.map(field => (
                <div 
                  key={field.path} 
                  className={`field-item ${selectedFields.includes(field.path) ? 'selected' : ''}`}
                  onClick={() => toggleField(field.path)}
                >
                  {selectedFields.includes(field.path) ? 
                    <CheckSquare size={16} className="check-icon" /> : 
                    <Square size={16} className="check-icon" />
                  }
                  <span className="field-name">{field.name}</span>
                  <span className="field-type">{field.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="export-dialog-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button 
            className="btn-confirm" 
            onClick={handleExport} 
            disabled={selectedFields.length === 0 || loading}
          >
            <Download size={14} />
            {loading ? '导出中...' : '确认导出'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
