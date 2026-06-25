/**
 * ELFK 视图管理页面
 */

import { useState, useEffect, useMemo } from 'react';
import { getViewList, deleteView, getElfkViewProjects } from '../../../services/elfk/view';
import { getDictDetail } from '../../../services/system/dict';
import { confirm } from '../../../components/ConfirmModal';
import type { ViewListItem } from '../../../services/elfk/view';
import ViewForm from './components/ViewForm';
import ViewDetail from './components/ViewDetail';
import './style.css';

interface DictItem {
  key: string;
  value: string;
}

const ElfkView = () => {
  // 数据状态
  const [viewList, setViewList] = useState<ViewListItem[]>([]);
  const [projectOptions, setProjectOptions] = useState<DictItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<DictItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 筛选条件
  const [filterProject, setFilterProject] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterName, setFilterName] = useState('');

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 弹窗状态
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingView, setEditingView] = useState<ViewListItem | null>(null);
  const [detailView, setDetailView] = useState<ViewListItem | null>(null);

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const res = await getElfkViewProjects();
      if (res.code === 200 && res.data) {
        // 兼容 items 或直接数组
        const items = (res.data as any).items || res.data || [];
        setProjectOptions(Array.isArray(items) ? items.map((item: any) => ({
          key: item.project || item.key,
          value: item.project_name || item.value
        })) : []);
      }
    } catch (err) {
      console.error('获取项目列表失败:', err);
    }
  };

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const res = await getDictDetail('view');
      console.log('[Elfk/View] 请求: GET /system/dict/items?group=sys_view_dict');
      console.log('[Elfk/View] 响应:', JSON.stringify(res, null, 2));
      if (res.code === 200 && res.data) {
        setCategoryOptions(res.data.items || []);
      }
    } catch (err) {
      console.error('获取分类列表失败:', err);
    }
  };

  // 获取视图列表
  const fetchViewList = async () => {
    setLoading(true);
    try {
      const res = await getViewList();
      if (res.code === 200) {
        setViewList(res.data || []);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('获取视图列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    fetchProjects();
    fetchCategories();
    fetchViewList();
  }, []);

  // 过滤后的列表
  const filteredList = useMemo(() => {
    let result = viewList;
    if (filterProject) {
      result = result.filter(item => item.project === filterProject);
    }
    if (filterCategory) {
      result = result.filter(item => item.category === filterCategory);
    }
    if (filterName) {
      const keyword = filterName.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(keyword));
    }
    return result;
  }, [viewList, filterProject, filterCategory, filterName]);

  // 分页后的数据
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage]);

  // 总页数
  const totalPages = Math.ceil(filteredList.length / pageSize);

  // 获取项目名称
  const getProjectName = (key: string) => {
    const item = projectOptions.find(p => p.key === key);
    return item?.value || key;
  };

  // 获取分类名称
  const getCategoryName = (key?: string) => {
    if (!key) return '未分类';
    const item = categoryOptions.find(c => c.key === key);
    return item?.value || key;
  };

  // 新增
  const handleAdd = () => {
    setEditingView(null);
    setShowForm(true);
  };

  // 编辑
  const handleEdit = (view: ViewListItem) => {
    setEditingView(view);
    setShowForm(true);
  };

  // 查看详情
  const handleViewDetail = (view: ViewListItem) => {
    setDetailView(view);
    setShowDetail(true);
  };

  // 删除
  const handleDelete = async (view: ViewListItem) => {
    if (!await confirm({ content: `确定要删除视图「${view.name}」吗？`, type: 'danger' })) return;
    try {
      const res = await deleteView(view.id);
      if (res.code === 200) {
        fetchViewList();
      }
    } catch (err) {
      console.error('删除视图失败:', err);
    }
  };

  // 表单成功回调
  const handleFormSuccess = () => {
    setShowForm(false);
    fetchViewList();
  };

  return (
    <div className="elfk-view-page">
      {/* 搜索栏 */}
      <div className="search-card">
        <div className="filter-row">
          <select
            value={filterProject}
            onChange={e => { setFilterProject(e.target.value); setCurrentPage(1); }}
            className="filter-select"
          >
            <option value="">全部项目</option>
            {projectOptions.map(item => (
              <option key={item.key} value={item.key}>{item.value}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            className="filter-select"
          >
            <option value="">全部分类</option>
            {categoryOptions.map(item => (
              <option key={item.key} value={item.key}>{item.value}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="搜索视图名称..."
            value={filterName}
            onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
            className="filter-input"
          />
        </div>
      </div>

      {/* 表格区域 */}
      <div className="table-card">
        <div className="table-header">
          <div className="header-left">
            <span className="title">视图列表</span>
            <span className="count">共 {filteredList.length} 个视图</span>
          </div>
          <button className="btn-primary" onClick={handleAdd}>+ 新建视图</button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>视图名称</th>
                <th>项目</th>
                <th>分类</th>
                <th>索引模式</th>
                <th>时间字段</th>
                <th>描述</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="loading-cell">加载中...</td></tr>
              ) : paginatedList.length === 0 ? (
                <tr><td colSpan={8} className="empty-cell">暂无数据</td></tr>
              ) : (
                paginatedList.map(view => (
                  <tr key={view.id}>
                    <td className="name-cell">{view.name}</td>
                    <td>{getProjectName(view.project)}</td>
                    <td>{getCategoryName(view.category)}</td>
                    <td className="pattern-cell">{view.index_pattern}</td>
                    <td>{view.time_field}</td>
                    <td className="desc-cell">{view.description || '-'}</td>
                    <td>{view.update_time || '-'}</td>
                    <td className="action-cell">
                      <button className="btn-link" onClick={() => handleViewDetail(view)}>详情</button>
                      <button className="btn-link" onClick={() => handleEdit(view)}>编辑</button>
                      <button className="btn-link danger" onClick={() => handleDelete(view)}>删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="page-info">共 {filteredList.length} 条</span>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >上一页</button>
            <span className="page-num">{currentPage} / {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >下一页</button>
          </div>
        )}
      </div>

      {/* 表单弹窗 */}
      {showForm && (
        <ViewForm
          visible={showForm}
          editData={editingView}
          projectOptions={projectOptions}
          categoryOptions={categoryOptions}
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 详情弹窗 */}
      {showDetail && detailView && (
        <ViewDetail
          visible={showDetail}
          data={detailView}
          projectOptions={projectOptions}
          categoryOptions={categoryOptions}
          onClose={() => setShowDetail(false)}
          onEdit={() => { setShowDetail(false); handleEdit(detailView); }}
        />
      )}
    </div>
  );
};

export default ElfkView;
