/**
 * 监控模块入口
 * 重定向到硬件监控页面
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MonitorIndex = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/monitor/hardware', { replace: true });
  }, [navigate]);
  
  return (
    <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
      正在跳转...
    </div>
  );
};

export default MonitorIndex;
