/**
 * 指标图表组件 - 使用 ECharts
 */

import { useEffect, useRef, memo } from 'react';
import * as echarts from 'echarts';
import type { MonitorMetric } from '../../../services/monitor';
import type { DataStandard } from '../../../types/monitor';
import { formatYAxisLabel, parseHostName, getSeriesColor, formatValueByStandard } from '../utils/chartUtils';
import './MetricChart.css';

interface MetricChartProps {
  metric: MonitorMetric;
  height?: number;
  isDetailed?: boolean;
  onDoubleClick?: () => void;
}

/** 获取当前是否为深色主题 */
const isDarkMode = () => document.documentElement.classList.contains('dark');

/** 获取主题相关颜色 */
const getThemeColors = () => {
  const dark = isDarkMode();
  return {
    textColor: dark ? '#a0a0a0' : '#606266',
    textMuted: dark ? '#666666' : '#909399',
    borderColor: dark ? '#333333' : '#E4E7ED',
    tooltipBg: dark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: dark ? '#444' : '#eee',
    tooltipText: dark ? '#e5e5e5' : '#333',
  };
};

// 自定义比较函数：比较数据是否真正变化
const areEqual = (prev: MetricChartProps, next: MetricChartProps) => {
  if (prev.metric.view_id !== next.metric.view_id) return false;
  if (prev.height !== next.height) return false;
  if (prev.isDetailed !== next.isDetailed) return false;
  
  // 比较数据的第一个和最后一个时间戳，判断数据范围是否变化
  const prevData = prev.metric.data?.result?.[0]?.values;
  const nextData = next.metric.data?.result?.[0]?.values;
  
  if (!prevData && !nextData) return true;
  if (!prevData || !nextData) return false;
  if (prevData.length !== nextData.length) return false;
  
  // 比较首尾时间戳
  const prevFirst = prevData[0]?.[0];
  const prevLast = prevData[prevData.length - 1]?.[0];
  const nextFirst = nextData[0]?.[0];
  const nextLast = nextData[nextData.length - 1]?.[0];
  
  return prevFirst === nextFirst && prevLast === nextLast;
};

const MetricChart = memo(({
  metric,
  height = 300,
  isDetailed = false,
  onDoubleClick,
}: MetricChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const currentMode = useRef<string>('all');
  const allLegends = useRef<string[]>([]);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化或重用图表实例
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
    } else {
      // 清空图表，触发重新渲染动画
      chartInstance.current.clear();
    }

    // 创建图表配置
    const option = createChartOption(metric, isDetailed);
    chartInstance.current.setOption(option);

    // 保存所有图例名称
    if (option.legend && Array.isArray(option.legend.data)) {
      allLegends.current = [...option.legend.data];
    }

    // 重置模式
    currentMode.current = 'all';

    // 监听图例点击事件
    chartInstance.current.off('legendselectchanged');
    chartInstance.current.on('legendselectchanged', handleLegendClick);

    // 窗口大小变化时调整图表
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [metric, isDetailed]);

  // 处理图例点击
  const handleLegendClick = (params: any) => {
    const { name } = params;
    const chart = chartInstance.current;
    if (!chart || !allLegends.current.length) return;

    // 如果当前是全选模式，点击某个图例时切换到单选模式
    if (currentMode.current === 'all') {
      showOnlyOneLegend(name);
      currentMode.current = name;
      return;
    }

    // 如果当前是单选模式，且点击的是当前选中的图例，则切换到全选模式
    if (currentMode.current === name) {
      showAllLegends();
      currentMode.current = 'all';
      return;
    }

    // 如果当前是单选模式，且点击的是其他图例，则切换到新的图例
    showOnlyOneLegend(name);
    currentMode.current = name;
  };

  // 只显示一个图例
  const showOnlyOneLegend = (legendName: string) => {
    const chart = chartInstance.current;
    if (!chart) return;

    const legendSelected: Record<string, boolean> = {};
    allLegends.current.forEach(legend => {
      legendSelected[legend] = legend === legendName;
    });

    chart.setOption({ legend: { selected: legendSelected } });
  };

  // 显示所有图例
  const showAllLegends = () => {
    const chart = chartInstance.current;
    if (!chart) return;

    const legendSelected: Record<string, boolean> = {};
    allLegends.current.forEach(legend => {
      legendSelected[legend] = true;
    });

    chart.setOption({ legend: { selected: legendSelected } });
  };

  // 组件卸载时销毁图表
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <div
      ref={chartRef}
      className="echarts-container"
      style={{ height }}
      onDoubleClick={onDoubleClick}
    />
  );
}, areEqual);

MetricChart.displayName = 'MetricChart';

/** 判断时间跨度是否超过一天 */
function isTimeSpanOverOneDay(metric: MonitorMetric): boolean {
  if (!metric.data?.result?.length) return false;
  
  let minTime = Infinity;
  let maxTime = -Infinity;
  
  metric.data.result.forEach(result => {
    result.values?.forEach(([timestamp]) => {
      minTime = Math.min(minTime, timestamp);
      maxTime = Math.max(maxTime, timestamp);
    });
  });
  
  // 超过24小时（86400秒）
  return (maxTime - minTime) > 86400;
}

/** 格式化时间戳 */
function formatTimestamp(timestamp: number, showDate: boolean): string {
  const date = new Date(timestamp * 1000);
  if (showDate) {
    // 显示日期+时间: MM-DD HH:mm
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  }
  // 只显示时间: HH:mm:ss
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** 创建图表配置 */
function createChartOption(metric: MonitorMetric, isDetailed: boolean) {
  const series: echarts.SeriesOption[] = [];
  const standard = (metric.standard || 'default') as DataStandard;
  const showDate = isTimeSpanOverOneDay(metric);
  const colors = getThemeColors();
  
  // 收集所有时间戳并排序
  const allTimestamps = new Set<number>();

  // 处理数据
  if (metric.data?.resultType === 'matrix' && metric.data.result?.length > 0) {
    // 先收集所有时间戳
    metric.data.result.forEach(result => {
      result.values?.forEach(([timestamp]) => {
        allTimestamps.add(timestamp);
      });
    });
    
    // 排序时间戳
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    const xAxisData = sortedTimestamps.map(ts => formatTimestamp(ts, showDate));
    
    // 创建时间戳到索引的映射
    const timestampToTime = new Map<number, string>();
    sortedTimestamps.forEach((ts, i) => {
      timestampToTime.set(ts, xAxisData[i]);
    });

    metric.data.result.forEach((result, idx) => {
      if (!result.values?.length) return;

      const seriesName = parseHostName(result.metric, idx);
      const seriesData: [string, number][] = [];

      result.values.forEach(([timestamp, value]) => {
        const time = timestampToTime.get(timestamp) || formatTimestamp(timestamp, showDate);
        const numericValue = formatValueByStandard(value, standard);
        seriesData.push([time, numericValue]);
      });

      series.push({
        name: seriesName,
        type: 'line',
        showSymbol: false,
        smooth: true,
        connectNulls: false,
        data: seriesData,
        itemStyle: { color: getSeriesColor(idx) },
      });
    });

    // 所有图例默认选中
    const legendSelected: Record<string, boolean> = {};
    series.forEach(s => {
      legendSelected[s.name as string] = true;
    });

    return createChartConfig(xAxisData, series, legendSelected, standard, isDetailed, colors);
  }

  return createChartConfig([], series, {}, standard, isDetailed, colors);
}

/** 创建图表配置对象 */
function createChartConfig(
  xAxisData: string[],
  series: echarts.SeriesOption[],
  legendSelected: Record<string, boolean>,
  standard: DataStandard,
  isDetailed: boolean,
  colors: ReturnType<typeof getThemeColors>
) {

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicInOut' as const,
    grid: {
      left: '3%',
      right: '3%',
      bottom: isDetailed ? '15%' : '18%',
      top: '10%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: colors.tooltipText },
      formatter: (params: any) => {
        const time = params[0]?.data?.[0] || '';
        let content = `<div style="font-weight:bold;margin-bottom:4px;">${time}</div>`;
        params.forEach((p: any) => {
          const val = formatYAxisLabel(p.data[1], standard);
          content += `<div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;">
            <span style="display:flex;align-items:center;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:5px;"></span>
              ${p.seriesName}:
            </span>
            <span style="font-weight:bold;margin-left:15px;">${val}</span>
          </div>`;
        });
        return content;
      },
    },
    legend: {
      data: series.map(s => s.name as string),
      type: 'scroll',
      bottom: 0,
      textStyle: { color: colors.textColor, fontSize: 11 },
      selectedMode: 'multiple',
      selected: legendSelected,
      pageTextStyle: { color: colors.textColor },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLine: { lineStyle: { color: colors.borderColor } },
      axisLabel: {
        color: colors.textMuted,
        formatter: (val: string) => val,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: true, lineStyle: { color: colors.borderColor } },
      splitLine: { lineStyle: { color: colors.borderColor, type: 'dashed' } },
      axisLabel: {
        color: colors.textMuted,
        formatter: (val: number) => formatYAxisLabel(val, standard),
      },
    },
    series,
    ...(isDetailed && {
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
    }),
  };
}

export default MetricChart;
