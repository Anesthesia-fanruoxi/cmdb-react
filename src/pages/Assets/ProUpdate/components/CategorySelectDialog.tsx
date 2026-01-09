/**
 * 发版服务选择弹框
 * - SCFQ 前端：管理端 / 店铺端
 * - Risk 后端：管理端 / 计数端 / 代理 / 全部
 */

import { X } from 'lucide-react';
import { confirm } from '../../../../components/ConfirmModal';

interface Props {
  visible: boolean;
  type: 'web' | 'backend';
  projectName: string;
  onSelect: (category: string) => void;
  onClose: () => void;
}

const CategorySelectDialog = ({ visible, type, onSelect, onClose }: Props) => {
  if (!visible) return null;

  const handleSelect = async (category: string, label: string) => {
    // 二次确认
    const confirmed = await confirm({
      title: type === 'web' ? 'SCFQ 前端发版确认' : 'Risk 后端发版确认',
      content: `确认选择 ${label} 进行发版？`,
      type: 'warning',
      okText: `确认${label}`,
      cancelText: '取消发版'
    });
    
    if (confirmed) {
      onSelect(category);
      onClose();
    }
  };

  const title = type === 'web' ? 'SCFQ 前端发版选择' : 'Risk 后端发版选择';

  return (
    <>
      <div className="category-overlay" onClick={onClose} />
      <div className="category-dialog">
        <div className="category-header">
          <h3>{title}</h3>
          <button className="category-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-body">
          <p className="category-hint">请选择发布范围：</p>
          
          {type === 'web' ? (
            // SCFQ 前端：2个选项
            <div className="category-buttons">
              <button className="category-btn" onClick={() => handleSelect('manager', '管理端')}>
                管理端 (Manager)
              </button>
              <button className="category-btn" onClick={() => handleSelect('seller', '店铺端')}>
                店铺端 (Seller)
              </button>
            </div>
          ) : (
            // Risk 后端：4个选项
            <div className="category-buttons">
              <div className="category-row">
                <button className="category-btn" onClick={() => handleSelect('manage', '管理端')}>
                  管理端 (Manager)
                </button>
                <button className="category-btn" onClick={() => handleSelect('count', '计数端')}>
                  计数端 (Count)
                </button>
              </div>
              <div className="category-row">
                <button className="category-btn" onClick={() => handleSelect('proxy', '代理')}>
                  代理 (Proxy)
                </button>
                <button className="category-btn primary" onClick={() => handleSelect('all', '全部')}>
                  全部 (All)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .category-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; }
        .category-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-color, #1a1a1a); border-radius: 8px; z-index: 2001; min-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .category-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #3a3a3a); }
        .category-header h3 { margin: 0; font-size: 16px; color: var(--text-color, #e0e0e0); }
        .category-close { background: none; border: none; cursor: pointer; color: var(--text-secondary, #999); }
        .category-body { padding: 24px 20px; }
        .category-hint { margin: 0 0 20px; text-align: center; color: var(--text-secondary, #999); font-size: 14px; }
        .category-buttons { display: flex; flex-direction: column; gap: 12px; }
        .category-row { display: flex; gap: 12px; justify-content: center; }
        .category-btn { flex: 1; min-width: 140px; padding: 12px 20px; border: 1px solid var(--border-color, #3a3a3a); background: var(--bg-secondary, #2a2a2a); color: var(--text-color, #e0e0e0); border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .category-btn:hover { border-color: var(--primary-color, #1890ff); color: var(--primary-color, #1890ff); }
        .category-btn.primary { background: var(--primary-color, #1890ff); color: #fff; border-color: var(--primary-color, #1890ff); }
        .category-btn.primary:hover { background: #40a9ff; border-color: #40a9ff; }
      `}</style>
    </>
  );
};

export default CategorySelectDialog;
