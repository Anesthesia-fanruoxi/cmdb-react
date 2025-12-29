/**
 * 独立窗口容器
 * 用于加载从主窗口分离出来的内容
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { closeCurrentWindow } from '../../utils/window';
import '../../index.css';

const DetachedWindow = () => {
  const [searchParams] = useSearchParams();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [props, setProps] = useState<Record<string, unknown>>({});

  // ESC 键关闭窗口
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCurrentWindow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const type = searchParams.get('type');
    const data = searchParams.get('data');

    if (data) {
      try {
        setProps(JSON.parse(decodeURIComponent(data)));
      } catch (e) {
        console.error('解析窗口数据失败:', e);
      }
    }

    // 根据类型动态加载组件
    const loadComponent = async () => {
      switch (type) {
        case 'dept-project': {
          const mod = await import('../System/Dept/components/ProjectConfig');
          setComponent(() => mod.default);
          break;
        }
        case 'dept-form': {
          const mod = await import('../System/Dept/components/DeptForm');
          setComponent(() => mod.default);
          break;
        }
        case 'table-detail': {
          const mod = await import('../Sql/Search/components/TableDetailContent');
          setComponent(() => mod.default);
          break;
        }
        case 'sql-workspace': {
          const mod = await import('../Sql/Search/components/SqlWorkspaceDetached');
          setComponent(() => mod.default);
          break;
        }
        case 'user-project': {
          const mod = await import('../System/User/components/UserProjectConfig');
          setComponent(() => mod.default);
          break;
        }
        case 'role-permission': {
          const mod = await import('../System/Role/components/RolePermissionConfig');
          setComponent(() => mod.default);
          break;
        }
        case 'elfk-search': {
          const mod = await import('../Elfk/Search/components/ElfkSearchDetached');
          setComponent(() => mod.default);
          break;
        }
        default:
          console.warn('未知的窗口类型:', type);
      }
    };

    loadComponent();
  }, [searchParams]);

  if (!Component) {
    return <div className="detached-loading">加载中...</div>;
  }

  return <Component {...props} />;
};

export default DetachedWindow;
