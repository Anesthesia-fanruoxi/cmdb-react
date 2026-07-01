/**
 * 字典管理 - 对话框组件
 */

import type { DictGroup } from '../../../../types/system';

export interface ItemForm {
  group_key: string;
  group_name: string;
  item_key: string;
  item_name: string;
  item_value: string;
  color: string;
}

interface ItemDialogProps {
  visible: boolean;
  title: string;
  form: ItemForm;
  groupList: DictGroup[];
  onClose: () => void;
  onFormChange: (form: ItemForm) => void;
  onSubmit: () => void;
}

export const ItemDialog = ({ visible, title, form, groupList, onClose, onFormChange, onSubmit }: ItemDialogProps) => {
  if (!visible) return null;
  const isAdd = title === '新增字典项';
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onSubmit(); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isAdd && (
            <>
              <div className="form-group">
                <label>分组 *</label>
                <input list="group-options" value={form.group_key} onKeyDown={onEnter}
                  onChange={e => {
                    const key = e.target.value;
                    const found = groupList.find(g => g.group_key === key);
                    onFormChange({ ...form, group_key: key, group_name: found?.group_name || '' });
                  }}
                  placeholder="选择或手动输入分组标识"
                />
                <datalist id="group-options">
                  {groupList.map(g => <option key={g.group_key} value={g.group_key}>{g.group_name}</option>)}
                </datalist>
              </div>
              {!groupList.some(g => g.group_key === form.group_key) && form.group_key && (
                <div className="form-group">
                  <label>分组名称</label>
                  <input value={form.group_name} onChange={e => onFormChange({ ...form, group_name: e.target.value })} onKeyDown={onEnter} placeholder="新分组的中文名称" />
                </div>
              )}
            </>
          )}
          <div className="form-group">
            <label>标识 *</label>
            <input value={form.item_key} onChange={e => onFormChange({ ...form, item_key: e.target.value })} onKeyDown={onEnter} placeholder="英文标识" readOnly={!isAdd} />
          </div>
          <div className="form-group">
            <label>名称</label>
            <input value={form.item_name} onChange={e => onFormChange({ ...form, item_name: e.target.value })} onKeyDown={onEnter} placeholder="中文描述名称" />
          </div>
          <div className="form-group">
            <label>值 *</label>
            <input value={form.item_value} onChange={e => onFormChange({ ...form, item_value: e.target.value })} onKeyDown={onEnter} placeholder="项值" />
          </div>
          <div className="form-group">
            <label>颜色</label>
            <input type="color" value={form.color || '#1890ff'} onChange={e => onFormChange({ ...form, color: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={onSubmit}>确定</button>
        </div>
      </div>
    </div>
  );
};

interface GroupDialogProps {
  visible: boolean;
  form: { group_key: string; group_name: string };
  onClose: () => void;
  onFormChange: (form: { group_key: string; group_name: string }) => void;
  onSubmit: () => void;
}

export const GroupDialog = ({ visible, form, onClose, onFormChange, onSubmit }: GroupDialogProps) => {
  if (!visible) return null;
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onSubmit(); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建分组</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>分组标识 *</label>
            <input value={form.group_key} onChange={e => onFormChange({ ...form, group_key: e.target.value })} onKeyDown={onEnter} placeholder="英文标识（全局唯一）" />
          </div>
          <div className="form-group">
            <label>分组名称 *</label>
            <input value={form.group_name} onChange={e => onFormChange({ ...form, group_name: e.target.value })} onKeyDown={onEnter} placeholder="中文名称" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={onSubmit}>确定</button>
        </div>
      </div>
    </div>
  );
};
