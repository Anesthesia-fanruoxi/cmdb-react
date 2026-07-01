/**
 * 字典管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { getDictGroups, getDictItems, createDictItem, updateDictItem, deleteDictItem, createDictGroup, deleteDictGroup } from '../../../services/system/dict';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import type { DictGroup, DictItem } from '../../../types/system';
import { ItemDialog, GroupDialog, type ItemForm } from './components/DictModals';
import './style.css';

const DictManagement = () => {
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [groupList, setGroupList] = useState<DictGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<DictGroup | null>(null);
  const [dictItems, setDictItems] = useState<DictItem[]>([]);

  // 对话框状态
  const [itemDialog, setItemDialog] = useState({ visible: false, title: '' });
  const [itemForm, setItemForm] = useState<ItemForm>({ group_key: '', group_name: '', item_key: '', item_name: '', item_value: '', color: '' });
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupForm, setGroupForm] = useState({ group_key: '', group_name: '' });

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
    setItemDialog({ visible: true, title: '新增字典项' });
    setItemForm({
      group_key: currentGroup?.group_key || '',
      group_name: currentGroup?.group_name || '',
      item_key: '', item_name: '', item_value: '', color: '',
    });
  };

  const handleEditItem = (row: DictItem) => {
    setItemDialog({ visible: true, title: '编辑字典项' });
    setItemForm({
      group_key: currentGroup?.group_key || '',
      group_name: currentGroup?.group_name || '',
      item_key: row.item_key,
      item_name: row.item_name || '',
      item_value: row.item_value,
      color: row.color?.toUpperCase() || '',
    });
  };

  const handleCreateGroup = async () => {
    if (!groupForm.group_key || !groupForm.group_name) { toast.warning('请填写完整分组信息'); return; }
    try {
      const res = await createDictGroup(groupForm);
      if (res.code === 200) {
        toast.success('分组创建成功');
        setGroupDialog(false);
        setGroupForm({ group_key: '', group_name: '' });
        fetchGroupList();
      }
    } catch (error) {
      console.error('创建分组失败:', error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    const ok = await confirm({
      title: '确认删除分组',
      content: `删除分组“${currentGroup.group_name}”将同时删除该分组下所有字典项，确认继续？`,
      type: 'danger',
    });
    if (!ok) return;
    try {
      const res = await deleteDictGroup(currentGroup.group_key);
      if (res.code === 200) {
        toast.success('分组删除成功');
        setCurrentGroup(null);
        setDictItems([]);
        fetchGroupList();
      }
    } catch (error) {
      console.error('删除分组失败:', error);
    }
  };

  const handleItemSubmit = async () => {
    if (!itemForm.item_key || !itemForm.item_value) { toast.warning('请填写完整信息'); return; }
    if (!itemForm.group_key) { toast.warning('请选择或填写分组'); return; }
    try {
      const isAdd = itemDialog.title === '新增字典项';
      if (isAdd) {
        // 若分组不存在，先自动创建
        if (!groupList.some(g => g.group_key === itemForm.group_key)) {
          const gRes = await createDictGroup({ group_key: itemForm.group_key, group_name: itemForm.group_name || itemForm.group_key });
          if (gRes.code !== 200) { toast.error('分组创建失败'); return; }
        }
        const res = await createDictItem({
          group_key: itemForm.group_key,
          item_key: itemForm.item_key,
          item_name: itemForm.item_name || undefined,
          item_value: itemForm.item_value,
          color: itemForm.color || '',
        });
        if (res.code === 200) {
          toast.success('新增成功');
          setItemDialog({ visible: false, title: '' });
          fetchDictItems(itemForm.group_key);
          fetchGroupList();
        }
      } else {
        const existing = dictItems.find(i => i.item_key === itemForm.item_key);
        if (!existing) { toast.error('未找到要编辑的字典项'); return; }
        const res = await updateDictItem({
          id: existing.id,
          item_name: itemForm.item_name || undefined,
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
          <button className="btn-primary btn-sm" onClick={() => setGroupDialog(true)}>+ 新建分组</button>
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
            <div className="panel-actions">
              <button className="btn-primary" onClick={handleAddItem}>+ 新增</button>
              <button className="btn-default btn-sm danger" onClick={handleDeleteGroup}>删除分组</button>
            </div>
          </div>
          <div className="panel-body">
            {itemsLoading ? <div className="loading">加载中...</div> : (
              <table className="dict-table">
                <thead>
                  <tr>
                    <th>标识</th>
                    <th>名称</th>
                    <th>值</th>
                    <th>颜色</th>
                    <th style={{ width: 160 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {dictItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.item_key}</td>
                      <td>{item.item_name || '-'}</td>
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

      {/* 新增/编辑字典项对话框 */}
      <ItemDialog
        visible={itemDialog.visible}
        title={itemDialog.title}
        form={itemForm}
        groupList={groupList}
        onClose={() => setItemDialog({ visible: false, title: '' })}
        onFormChange={setItemForm}
        onSubmit={handleItemSubmit}
      />

      {/* 新建分组对话框 */}
      <GroupDialog
        visible={groupDialog}
        form={groupForm}
        onClose={() => setGroupDialog(false)}
        onFormChange={setGroupForm}
        onSubmit={handleCreateGroup}
      />
    </div>
  );
};

export default DictManagement;
