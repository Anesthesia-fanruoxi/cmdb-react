/**
 * 字典管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { getDictGroups, getDictItems, createDictItem, updateDictItem, deleteDictItem } from '../../../services/system/dict';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import type { DictGroup, DictItem } from '../../../types/system';
import './style.css';

interface ItemForm {
  item_key: string;
  item_value: string;
  color: string;
}

const DictManagement = () => {
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [groupList, setGroupList] = useState<DictGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<DictGroup | null>(null);
  const [dictItems, setDictItems] = useState<DictItem[]>([]);

  // 对话框状态
  const [itemDialog, setItemDialog] = useState({ visible: false, title: '' });
  const [itemForm, setItemForm] = useState<ItemForm>({ item_key: '', item_value: '', color: '' });

  const fetchGroupList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDictGroups();
      if (res.code === 200) setGroupList(res.data || []);
    } catch (error) {
      console.error('获取分组列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDictItems = useCallback(async (groupKey: string) => {
    try {
      setItemsLoading(true);
      const res = await getDictItems(groupKey);
      if (res.code === 200) setDictItems(res.data?.items || []);
    } catch (error) {
      console.error('获取字典项失败:', error);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroupList(); }, [fetchGroupList]);

  const handleGroupClick = (row: DictGroup) => {
    setCurrentGroup(row);
    fetchDictItems(row.group_key);
  };

  const handleAddItem = () => {
    if (!currentGroup) { toast.warning('请先选择分组'); return; }
    setItemDialog({ visible: true, title: '新增字典项' });
    setItemForm({ item_key: '', item_value: '', color: '' });
  };

  const handleEditItem = (row: DictItem) => {
    if (!currentGroup) { toast.warning('请先选择分组'); return; }
    setItemDialog({ visible: true, title: '编辑字典项' });
    setItemForm({
      item_key: row.item_key,
      item_value: row.item_value,
      color: row.color?.toUpperCase() || '',
    });
  };

  const handleItemSubmit = async () => {
    if (!itemForm.item_key || !itemForm.item_value) { toast.warning('请填写完整信息'); return; }
    try {
      const isAdd = itemDialog.title === '新增字典项';
      if (isAdd) {
        const res = await createDictItem({
          group_key: currentGroup!.group_key,
          group_name: currentGroup!.group_name,
          item_key: itemForm.item_key,
          item_value: itemForm.item_value,
          color: itemForm.color || '',
        });
        if (res.code === 200) {
          toast.success('新增成功');
          setItemDialog({ visible: false, title: '' });
          fetchDictItems(currentGroup!.group_key);
          fetchGroupList();
        }
      } else {
        const existing = dictItems.find(i => i.item_key === itemForm.item_key);
        if (!existing) { toast.error('未找到要编辑的字典项'); return; }
        const res = await updateDictItem({
          id: existing.id,
          item_value: itemForm.item_value,
          color: itemForm.color || '',
        });
        if (res.code === 200) {
          toast.success('更新成功');
          setItemDialog({ visible: false, title: '' });
          fetchDictItems(currentGroup!.group_key);
        }
      }
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleDelete = async (row: DictItem) => {
    const ok = await confirm({ title: '确认删除', content: `删除字典项"${row.item_value}"？`, type: 'danger' });
    if (!ok) return;
    try {
      const res = await deleteDictItem(row.id);
      if (res.code === 200) {
        toast.success('删除成功');
        fetchDictItems(currentGroup!.group_key);
        fetchGroupList();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  return (
    <div className="dict-page">
      {/* 分组列表 */}
      <div className="dict-panel">
        <div className="panel-header">
          <h3>字典分组</h3>
        </div>
        <div className="panel-body">
          {loading ? <div className="loading">加载中...</div> : (
            <table className="dict-table">
              <thead>
                <tr>
                  <th>分组标识</th>
                  <th>分组名称</th>
                  <th>项数量</th>
                </tr>
              </thead>
              <tbody>
                {groupList.map(g => (
                  <tr
                    key={g.group_key}
                    className={currentGroup?.group_key === g.group_key ? 'active' : ''}
                    onClick={() => handleGroupClick(g)}
                  >
                    <td>{g.group_key}</td>
                    <td>{g.group_name}</td>
                    <td>{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 字典项列表 */}
      {currentGroup && (
        <div className="dict-panel">
          <div className="panel-header">
            <h3>{currentGroup.group_name} - 字典项</h3>
            <button className="btn-primary" onClick={handleAddItem}>+ 新增</button>
          </div>
          <div className="panel-body">
            {itemsLoading ? <div className="loading">加载中...</div> : (
              <table className="dict-table">
                <thead>
                  <tr>
                    <th>标识</th>
                    <th>名称</th>
                    <th>颜色</th>
                    <th style={{ width: 160 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {dictItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.item_key}</td>
                      <td>{item.item_value}</td>
                      <td>
                        {item.color ? (
                          <span className="color-tag" style={{ background: item.color }}>{item.item_value}</span>
                        ) : item.item_value}
                      </td>
                      <td>
                        <button className="link-btn" onClick={() => handleEditItem(item)}>编辑</button>
                        <button className="link-btn danger" onClick={() => handleDelete(item)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 新增/编辑对话框 */}
      {itemDialog.visible && (
        <div className="modal-overlay" onClick={() => setItemDialog({ visible: false, title: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{itemDialog.title}</h3>
              <button className="btn-close" onClick={() => setItemDialog({ visible: false, title: '' })}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>标识 *</label>
                <input value={itemForm.item_key} onChange={e => setItemForm({ ...itemForm, item_key: e.target.value })} placeholder="英文标识" />
              </div>
              <div className="form-group">
                <label>名称 *</label>
                <input value={itemForm.item_value} onChange={e => setItemForm({ ...itemForm, item_value: e.target.value })} placeholder="显示名称" />
              </div>
              <div className="form-group">
                <label>颜色</label>
                <input type="color" value={itemForm.color || '#1890ff'} onChange={e => setItemForm({ ...itemForm, color: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-default" onClick={() => setItemDialog({ visible: false, title: '' })}>取消</button>
              <button className="btn-primary" onClick={handleItemSubmit}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DictManagement;
