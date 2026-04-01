/**
 * 全屏结果面板组件
 * 专门处理全屏模式下的无限滚动加载
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  columns: string[];
  results: unknown[][];
  total: number;
  took: number;
  dbName?: string;
  currentPage: number;
  onPageChange: (page: number, size: number) => void;
  onClose: () => void;
}

const pageSize = 20; // 固定每页20条

const FullscreenResultPanel = ({
  columns, results, total, took, dbName, currentPage, onPageChange, onClose
}: Props) => {
  // 累积数据
  const [accumulatedData, setAccumulatedData] = useState<unknown[][]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // 用于批量加载时收集数据
  const batchLoadingDataRef = useRef<unknown[][]>([]);
  const batchLoadingPageRef = useRef<number>(0);
  
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 滚动节流定时器
  const scrollTimerRef = useRef<number | null>(null);
  
  const totalPages = Math.ceil(total / pageSize) || 1;
  const hasMore = currentPage < totalPages;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // 初始化：批量加载前3页
  useEffect(() => {
    if (currentPage === 1 && total > 20) {
      console.log('[全屏初始化] 开始批量加载前3页数据');
      batchLoadingDataRef.current = [...results]; // 第1页
      batchLoadingPageRef.current = 1;
      
      // 触发加载第2页
      onPageChange(2, pageSize);
    } else {
      // 数据不足，直接使用当前数据
      setAccumulatedData([...results]);
      setIsInitialLoading(false);
    }
  }, []); // 只在组件挂载时执行一次

  // 监听批量加载过程
  useEffect(() => {
    if (!isInitialLoading || batchLoadingPageRef.current === 0) return;
    
    // 第2页数据到达
    if (currentPage === 2 && batchLoadingPageRef.current === 1 && results.length > 0) {
      console.log('[批量加载] 第2页数据到达，追加到缓存');
      batchLoadingDataRef.current.push(...results);
      batchLoadingPageRef.current = 2;
      
      // 继续加载第3页
      if (total > 40) {
        console.log('[批量加载] 触发加载第3页');
        onPageChange(3, pageSize);
      } else {
        // 只有2页，完成加载
        console.log('[批量加载] 完成，总计:', batchLoadingDataRef.current.length);
        setAccumulatedData([...batchLoadingDataRef.current]);
        setIsInitialLoading(false);
        batchLoadingPageRef.current = 0;
      }
      
    // 第3页数据到达
    } else if (currentPage === 3 && batchLoadingPageRef.current === 2 && results.length > 0) {
      console.log('[批量加载] 第3页数据到达，追加到缓存');
      batchLoadingDataRef.current.push(...results);
      
      // 完成批量加载
      console.log('[批量加载] 完成，总计:', batchLoadingDataRef.current.length);
      setAccumulatedData([...batchLoadingDataRef.current]);
      setIsInitialLoading(false);
      batchLoadingPageRef.current = 0;
    }
  }, [isInitialLoading, currentPage, results, total, onPageChange]);

  // 监听滚动加载的数据追加
  useEffect(() => {
    if (isInitialLoading || !isLoadingMore) return;
    
    // 只处理滚动加载（页码 > 3）
    if (currentPage > 3 && results.length > 0) {
      console.log(`[滚动加载] 第${currentPage}页数据到达，准备追加 ${results.length} 条`);
      
      // 保存滚动位置
      const savedScrollTop = scrollContainerRef.current?.scrollTop || 0;
      
      setAccumulatedData(prev => {
        if (prev.length === 0) return prev;
        
        const lastRow = prev[prev.length - 1];
        const firstNewRow = results[0];
        
        // 避免重复追加
        if (JSON.stringify(lastRow) !== JSON.stringify(firstNewRow)) {
          const newData = [...prev, ...results];
          console.log(`[滚动加载] 追加后总计: ${newData.length} 条`);
          
          // 恢复滚动位置
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = savedScrollTop;
              console.log(`[滚动加载] 恢复滚动位置: ${savedScrollTop}px`);
            }
          });
          
          return newData;
        }
        
        console.log(`[滚动加载] 数据重复，跳过追加`);
        return prev;
      });
      
      setIsLoadingMore(false);
    }
  }, [isInitialLoading, isLoadingMore, currentPage, results]);

  // 处理滚动事件
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    
    if (scrollTimerRef.current) {
      cancelAnimationFrame(scrollTimerRef.current);
    }
    
    scrollTimerRef.current = requestAnimationFrame(() => {
      const scrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const threshold = 100;
      
      // 滚动到底部且未在加载且还有更多数据
      if (distanceToBottom < threshold && !isLoadingMore && hasMore && !isInitialLoading) {
        console.log('[触发加载] 开始加载下一页');
        setIsLoadingMore(true);
        onPageChange(currentPage + 1, pageSize);
      }
    }) as unknown as number;
  }, [isLoadingMore, hasMore, isInitialLoading, currentPage, onPageChange]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        cancelAnimationFrame(scrollTimerRef.current);
      }
    };
  }, []);

  // 键盘方向键控制滚动
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scrollContainerRef.current) return;
      
      const scrollStep = 100; // 每次滚动的像素
      const container = scrollContainerRef.current;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          container.scrollTop -= scrollStep;
          break;
        case 'ArrowDown':
          e.preventDefault();
          container.scrollTop += scrollStep;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          container.scrollLeft -= scrollStep;
          break;
        case 'ArrowRight':
          e.preventDefault();
          container.scrollLeft += scrollStep;
          break;
        case 'PageUp':
          e.preventDefault();
          container.scrollTop -= container.clientHeight;
          break;
        case 'PageDown':
          e.preventDefault();
          container.scrollTop += container.clientHeight;
          break;
        case 'Home':
          e.preventDefault();
          container.scrollTop = 0;
          break;
        case 'End':
          e.preventDefault();
          container.scrollTop = container.scrollHeight;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="fullscreen-result-panel">
      {/* 顶部 */}
      <div className="fullscreen-header">
        <div className="header-left">
          <span className="header-title">查询结果（全屏）</span>
        </div>
        <div className="header-right">
          <button className="btn btn-link" onClick={onClose} title="退出全屏">
            ⤢
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div 
        ref={scrollContainerRef} 
        className="fullscreen-table-wrapper"
        onScroll={handleScroll}
      >
        {isInitialLoading ? (
          <div className="result-loading">加载中...</div>
        ) : (
          <>
            <table className="fullscreen-table">
              <thead>
                <tr>
                  <th className="row-num">#</th>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accumulatedData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="row-num">{idx + 1}</td>
                    {row.map((val, colIdx) => (
                      <td key={colIdx}>
                        {formatValue(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* 加载提示 */}
            {isLoadingMore && (
              <div className="loading-more">
                <span>加载中...</span>
              </div>
            )}
            
            {/* 没有更多数据 */}
            {!hasMore && accumulatedData.length > 0 && (
              <div className="no-more-data">
                <span>已加载全部数据 (共 {accumulatedData.length} 条)</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部统计 */}
      <div className="fullscreen-footer">
        <div className="result-stats">
          <span>总行数: {total}</span>
          <span>耗时: {took}ms</span>
          {dbName && <span>数据库: {dbName}</span>}
          <span>已加载: {accumulatedData.length} 条 / 共 {total} 条</span>
        </div>
      </div>
    </div>
  );
};

export default FullscreenResultPanel;
