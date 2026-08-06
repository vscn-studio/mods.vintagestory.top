'use client';

import * as echarts from 'echarts/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const values = [54, 68, 47, 78, 64, 91, 82];

function cssValue(element: Element, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function renderChart(chart: ECharts, host: HTMLDivElement, english: boolean): void {
  const shell = host.closest('.site-shell') ?? host;
  const paper = cssValue(shell, '--paper-bright', '#ffffff');
  const ink = cssValue(shell, '--ink', '#262722');
  const muted = cssValue(shell, '--muted', '#6e7065');
  const line = cssValue(shell, '--line', '#d8d4c8');
  const olive = cssValue(shell, '--olive', '#6b8e23');
  const labels = english ? ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'] : ['五', '六', '日', '一', '二', '三', '四'];
  const option: EChartsCoreOption = {
    animationDuration: 450,
    grid: { top: 18, right: 18, bottom: 30, left: 18, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: paper,
      borderColor: line,
      borderWidth: 1,
      textStyle: { color: ink, fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: olive, opacity: 0.5 } }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: line } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 11, margin: 12 }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      show: false,
      splitNumber: 4,
      splitLine: { lineStyle: { color: line, opacity: 0.6 } }
    },
    series: [{
      type: 'line',
      data: values,
      smooth: 0.25,
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: true,
      lineStyle: { color: olive, width: 3 },
      itemStyle: { color: olive, borderColor: paper, borderWidth: 2 },
      areaStyle: { color: 'rgba(107, 142, 35, 0.12)' }
    }]
  };
  chart.setOption(option, true);
}

export function AdminTrafficChart({ english }: { english: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    const shell = host.closest('.site-shell');
    const mutationObserver = new MutationObserver(() => renderChart(chart, host, english));

    renderChart(chart, host, english);
    resizeObserver.observe(host);
    if (shell) mutationObserver.observe(shell, { attributes: true, attributeFilter: ['class'] });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      chart.dispose();
    };
  }, [english]);

  return <div ref={hostRef} className="admin-chart" role="img" aria-label={english ? 'Traffic in the last 7 days' : '最近 7 天访问趋势'} />;
}
