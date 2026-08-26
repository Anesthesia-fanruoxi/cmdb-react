/**
 * 独立窗口容器
 * 用于加载从主窗口分离出来的内容
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { closeCurrentWindow } from '../../utils/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import '../../index.css';

const DetachedWindow = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') ?? '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [windowLabel, setWindowLabel] = useState('');

  // 获取当前窗口 label
  useEffect(() => {
    const label = getCurrentWebviewWindow().label.replace('detached-', '');
    setWindowLabel(label);
  }, []);

  // ESC 键直接关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCurrentWindow();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        setProps(JSON.parse(decodeURIComponent(data)));
      } catch (e) {
        console.error('解析窗口数据失败:', e);
      }
    }

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
        case 'desktop-notify': {
          const mod = await import('./components/DesktopNotifyWindow');
          setComponent(() => mod.default);
          break;
        }
        case 'tool-json': {
          const mod = await import('../Home/tools/JsonFormatter');
          setComponent(() => mod.JsonFormatterWindow);
          break;
        }
        case 'tool-password': {
          const mod = await import('../Home/tools/PasswordGen');
          setComponent(() => mod.PasswordGenWindow);
          break;
        }
        case 'tool-case': {
          const mod = await import('../Home/tools/CaseConvert');
          setComponent(() => mod.CaseConvertWindow);
          break;
        }
        case 'tool-cron': {
          const mod = await import('../Home/tools/CronExpr');
          setComponent(() => mod.CronExprWindow);
          break;
        }
        case 'tool-time': {
          const mod = await import('../Home/tools/TimeConvert');
          setComponent(() => mod.TimeConvertWindow);
          break;
        }
        case 'tool-qps': {
          const mod = await import('../Home/tools/QpsCalc');
          setComponent(() => mod.QpsCalcWindow);
          break;
        }
        case 'tool-byte': {
          const mod = await import('../Home/tools/ByteConvert');
          setComponent(() => mod.ByteConvertWindow);
          break;
        }
        default:
          console.warn('未知的窗口类型:', type);
      }
    };

    loadComponent();
  }, [searchParams, type]);

  if (!Component) {
    if (type === 'desktop-notify') {
      return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />;
    }
    return <div className="detached-loading">加载中...</div>;
  }

  return <Component {...props} windowLabel={windowLabel} />;
};

export default DetachedWindow;
