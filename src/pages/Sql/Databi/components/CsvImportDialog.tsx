/**
 * CSV 导入弹框组件
 */

import { useState, useRef, useEffect } from 'react';
import type { CsvDialogState } from '../types';

interface CsvImportDialogProps {
  state: CsvDialogState;
  onClose: () => void;
  onConfirm: () => void;
}

export const CsvImportDialog = ({
  state,
  onClose,
  onConfirm
}: CsvImportDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  const fullTableName = state.dbName && state.tableName 
    ? `${state.dbName}.${state.tableName}` 
    : state.tableName;

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.dialog-body, button')) {
      return;
    }
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  // 拖拽中
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 居中显示
  useEffect(() => {
    if (state.visible && dialogRef.current && position.x === 0 && position.y === 0) {
      const rect = dialogRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2
      });
    }
  }, [state.visible]);

  if (!state.visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div
        ref={dialogRef}
        className={`dialog-container ${isDragging ? 'dragging' : ''}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      >
        <div className="dialog-header" onMouseDown={handleDragStart}>
          <h2 className="dialog-title">导入注释 - {fullTableName}</h2>
        </div>

        <div className="dialog-body">
          {state.loading ? (
            <div className="loading-state">正在解析CSV文件...</div>
          ) : state.total > 0 ? (
            <>
              {/* 未匹配警告 */}
              {state.unmatched.length > 0 && (
                <div className="unmatched-warning">
                  <span className="warning-icon">⚠️</span>
                  <span>以下字段在表中未找到：{state.unmatched.join(', ')}</span>
                </div>
              )}

              {/* 预览表格 */}
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>字段名</th>
                      <th>原注释</th>
                      <th>新注释</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.matched.map((row) => (
                      <tr key={row.col_name}>
                        <td className="col-name">{row.col_name}</td>
                        <td className="col-old">{row.oldComment || '-'}</td>
                        <td className="col-new">{row.newComment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 统计信息 */}
              <div className="import-summary">
                共 {state.total} 个字段，匹配 {state.matched.length} 个
              </div>
            </>
          ) : null}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={state.matched.length === 0 || state.saving}
          >
            {state.saving ? '导入中...' : `确认导入 (${state.matched.length})`}
          </button>
        </div>
      </div>
    </>
  );
};
