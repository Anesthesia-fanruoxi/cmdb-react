/**
 * 指标图表组件 - 使用 ECharts
 */

import { useEffect, useRef, memo } from 'react';
import * as echarts from 'echarts';
import type { MonitorMetric } from '@/services/monitor';
import type { DataStandard } from '@/types/monitor';
import { formatYAxisLabel, parseHostName, getSeriesColor, getChartColorByName, formatValueByStandard } from '@/pages/Monitor/utils/chartUtils';
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
  
  // 比较 updated_at 字段（切换项目时会更新）
  if ((prev.metric as MonitorMetric & { updated_at?: string }).updated_at !== (next.metric as MonitorMetric & { updated_at?: string }).updated_at) return false;
  
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

    // 处理图例点击
    const onLegendClick = (params: { name: string }) => {
      const { name } = params;
      const chart = chartInstance.current;
      if (!chart || !allLegends.current.length) return;

      if (currentMode.current === 'all') {
        showOnlyOneLegend(name);
        currentMode.current = name;
        return;
      }

      if (currentMode.current === name) {
        showAllLegends();
        currentMode.current = 'all';
        return;
      }

      showOnlyOneLegend(name);
      currentMode.current = name;
    };

    // 监听图例点击事件
    chartInstance.current.off('legendselectchanged');
    // @ts-expect-error echarts 类型定义不完整
    chartInstance.current.on('legendselectchanged', onLegendClick);

    // 使用 ResizeObserver 监听容器大小变化（比 window resize 更可靠）
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    // 窗口大小变化时也调整图表
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [metric, isDetailed]);

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

/** 格式化时间戳 */
function formatTimestamp(timestamp: number, showDate: boolean): string {
  const date = new Date(timestamp * 1000);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  if (showDate) {
    // 跨天时显示完整日期+时间: MM-DD HH:mm:ss
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}:${second}`;
  }
  
  // 显示时分秒，与 Vue 版本一致
  return `${hour}:${minute}:${second}`;
}

/** 检查数据是否跨天 */
function isDataCrossingMidnight(metric: MonitorMetric): boolean {
  if (!metric.data?.result?.length) return false;
  
  let firstDate: number | null = null;
  
  for (const result of metric.data.result) {
    if (!result.values?.length) continue;
    
    for (const [timestamp] of result.values) {
      const date = new Date(timestamp * 1000);
      const currentDate = date.getDate();
      
      if (firstDate === null) {
        firstDate = currentDate;
      } else if (currentDate !== firstDate) {
        // 发现不同日期，说明跨天了
        return true;
      }
    }
  }
  
  return false;
}

/** 创建图表配置 */
function createChartOption(metric: MonitorMetric, isDetailed: boolean) {
  const series: echarts.SeriesOption[] = [];
  const standard = (metric.standard || 'default') as DataStandard;
  const colors = getThemeColors();
  
  // 检查是否跨天，跨天时所有时间都显示日期
  const showDate = isDataCrossingMidnight(metric);
  
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
    
    // 格式化 X 轴数据
    const xAxisData = sortedTimestamps.map(ts => formatTimestamp(ts, showDate));
    
    // 创建时间戳到格式化时间的映射
    const timestampToTime = new Map<number, string>();
    sortedTimestamps.forEach((ts, i) => {
      timestampToTime.set(ts, xAxisData[i]);
    });

    // 单系列时根据图表名称获取颜色，多系列时使用调色板
    const isSingleSeries = metric.data.result.length === 1;
    const chartColor = isSingleSeries ? getChartColorByName(metric.view_name) : '';

    metric.data.result.forEach((result, idx) => {
      if (!result.values?.length) return;

      const seriesName = parseHostName(result.metric, idx);
      const seriesData: [string, number][] = [];

      result.values.forEach(([timestamp, value]) => {
        const time = timestampToTime.get(timestamp) || formatTimestamp(timestamp, showDate);
        const numericValue = formatValueByStandard(value, standard);
        seriesData.push([time, numericValue]);
      });

      // 单系列使用基于名称的颜色，多系列使用调色板
      const seriesColor = isSingleSeries ? chartColor : getSeriesColor(idx);

      series.push({
        name: seriesName,
        type: 'line',
        showSymbol: isDetailed, // 详细模式显示数据点
        symbolSize: isDetailed ? 6 : 4,
        smooth: true,
        connectNulls: false,
        data: seriesData,
        itemStyle: { color: seriesColor },
        lineStyle: { color: seriesColor },
        // 始终显示区域填充
        areaStyle: { opacity: isDetailed ? 0.15 : 0.3 },
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
  // 只有一个系列时隐藏图例
  const showLegend = series.length > 1;

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
      bottom: showLegend ? '22%' : '12%', // 增加底部空间适应旋转标签
      top: isDetailed ? '12%' : '10%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: colors.tooltipText },
      formatter: (params: { data: unknown; color: string; seriesName: string }[]) => {
        const time = (params[0]?.data as [string, number])?.[0] || '';
        let content = `<div style="font-weight:bold;margin-bottom:4px;">${time}</div>`;
        params.forEach((p) => {
          const val = formatYAxisLabel((p.data as [string, number])[1], standard);
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
      show: showLegend,
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
        fontSize: 10,
        rotate: 30, // 旋转标签，与 Vue 版本一致
        formatter: (val: string) => val,
        // 普通模式30个，详细模式60个
        interval: isDetailed ? (index: number) => {
          const len = xAxisData.length;
          if (len <= 60) return true;
          if (index === 0 || index === len - 1) return true;
          const step = Math.floor(len / 60);
          return index % step === 0;
        } : (index: number) => {
          const len = xAxisData.length;
          if (len <= 30) return true;
          if (index === 0 || index === len - 1) return true;
          const step = Math.floor(len / 30);
          return index % step === 0;
        },
      },
      // 详细模式显示分割线
      ...(isDetailed && {
        splitLine: { show: true, lineStyle: { color: colors.borderColor, type: 'dashed' } },
      }),
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
    // 详细模式添加更多交互功能
    ...(isDetailed && {
      dataZoom: [
        { type: 'inside', start: 0, end: 100 }, // 鼠标滚轮缩放
      ],
      toolbox: {
        show: true,
        right: 20,
        top: 0,
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: '区域缩放', back: '还原' } },
          restore: { title: '重置' },
          saveAsImage: { title: '保存图片', pixelRatio: 2 },
        },
        iconStyle: { borderColor: colors.textMuted },
      },
    }),
  };
}

export default MetricChart;
