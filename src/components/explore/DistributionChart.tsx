import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { DataPoint, ColumnStats, FeatureDefinition } from '../../types';
import { FEATURE_LABELS } from '../../types';
import { histogram, kernelDensityEstimate } from '../../utils/stats';
import { THEME_COLORS, formatValue } from '../../utils/colors';
import { TARGET_FEATURE_ID } from '../../stores/featureStore';

interface DistributionChartProps {
  data: DataPoint[];
  feature: keyof DataPoint;
  stats: ColumnStats;
  width: number;
  height?: number;
  showKDE?: boolean;
  brushedIndices?: Set<number>;
  /** Optional feature definition for transformed/PCA features */
  featureDefinition?: FeatureDefinition;
}

const MARGIN = { top: 25, right: 15, bottom: 45, left: 55 };
const NUM_BINS = 25;

export function DistributionChart({
  data,
  feature,
  stats,
  width,
  height: propHeight,
  showKDE = true,
  brushedIndices,
  featureDefinition,
}: DistributionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate height based on width if not provided
  const height = propHeight ?? Math.round(width * 0.7);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Get feature values - use featureDefinition if available, otherwise use data
  const getValues = useMemo(() => {
    if (featureDefinition && featureDefinition.values.length > 0) {
      return featureDefinition.values;
    }
    // Fall back to DataPoint extraction for original features
    return data.map(d => d[feature]);
  }, [featureDefinition, data, feature]);

  // Calculate histogram and KDE
  const { bins, kde, xScale, yScale } = useMemo(() => {
    const values = getValues;
    const bins = histogram(values, NUM_BINS, [stats.min, stats.max]);
    const maxCount = Math.max(...bins.map(b => b.count));

    const xScale = d3.scaleLinear()
      .domain([stats.min, stats.max])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, maxCount * 1.1])
      .range([innerHeight, 0]);

    // KDE calculation
    const kde = showKDE ? kernelDensityEstimate(values, undefined, 100) : null;

    return { bins, kde, xScale, yScale };
  }, [getValues, stats, innerWidth, innerHeight, showKDE]);

  // Calculate brushed histogram if there's a selection
  const brushedBins = useMemo(() => {
    if (!brushedIndices || brushedIndices.size === 0) return null;

    const values = getValues;
    const brushedValues = values.filter((_, i) => brushedIndices.has(i));

    return histogram(brushedValues, NUM_BINS, [stats.min, stats.max]);
  }, [getValues, stats, brushedIndices]);

  useEffect(() => {
    if (!svgRef.current || innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line.horizontal')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 1);

    g.selectAll('line.vertical')
      .data(xScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 1);

    // Background bars (all data)
    const barWidth = Math.max(0, innerWidth / NUM_BINS - 2);
    g.selectAll('.bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.x0))
      .attr('y', d => yScale(d.count))
      .attr('width', barWidth)
      .attr('height', d => innerHeight - yScale(d.count))
      .attr('fill', brushedBins ? '#d0d0d0' : THEME_COLORS.accent)
      .attr('opacity', brushedBins ? 0.6 : 0.75)
      .attr('rx', 2);

    // Brushed bars (selected data)
    if (brushedBins) {
      g.selectAll('.brushed-bar')
        .data(brushedBins)
        .enter()
        .append('rect')
        .attr('class', 'brushed-bar')
        .attr('x', d => xScale(d.x0))
        .attr('y', d => yScale(d.count))
        .attr('width', barWidth)
        .attr('height', d => innerHeight - yScale(d.count))
        .attr('fill', THEME_COLORS.accent)
        .attr('opacity', 0.85)
        .attr('rx', 2);
    }

    // Add KDE line
    if (kde && showKDE) {
      // Scale KDE to match histogram
      const maxKDE = Math.max(...kde.y);
      const maxBinCount = Math.max(...bins.map(b => b.count));
      const kdeScale = maxBinCount / maxKDE;

      const line = d3.line<number>()
        .x((_, i) => xScale(kde.x[i]))
        .y((d) => yScale(d * kdeScale))
        .curve(d3.curveBasis);

      g.append('path')
        .datum(kde.y)
        .attr('fill', 'none')
        .attr('stroke', THEME_COLORS.warm)
        .attr('stroke-width', 2.5)
        .attr('d', line);
    }

    // X axis
    const xAxis = d3.axisBottom(xScale).ticks(5);
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text')
      .style('font-size', '13px')
      .style('fill', '#424242');

    xAxisG.selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Y axis
    const yAxis = d3.axisLeft(yScale).ticks(5);
    const yAxisG = g.append('g').call(yAxis);

    yAxisG.selectAll('text')
      .style('font-size', '13px')
      .style('fill', '#424242');

    yAxisG.selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#424242')
      .text('Count');

    // Mean line
    g.append('line')
      .attr('x1', xScale(stats.mean))
      .attr('x2', xScale(stats.mean))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', THEME_COLORS.primary)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');

    // Mean label
    g.append('text')
      .attr('x', xScale(stats.mean))
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', THEME_COLORS.primary)
      .text('μ');

  }, [bins, brushedBins, kde, xScale, yScale, innerWidth, innerHeight, showKDE, stats]);

  // Determine feature info from definition or original feature key
  const isTarget = featureDefinition
    ? featureDefinition.id === TARGET_FEATURE_ID
    : feature === 'soundPressureLevel';

  const featureName = featureDefinition
    ? featureDefinition.name
    : FEATURE_LABELS[feature];

  const featureType = featureDefinition?.type || 'original';

  // Type badge colors
  const typeBadgeColors = {
    original: '',
    transformed: 'bg-purple-100 text-purple-700',
    pca: 'bg-green-100 text-green-700',
  };

  return (
    <div className="bg-white rounded-lg p-3 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`text-base font-semibold ${isTarget ? 'text-warm' : 'text-gray-700'}`}>
            {featureName}
          </h4>
          {isTarget && (
            <span className="text-xs bg-warm text-white px-2 py-0.5 rounded-full">Target</span>
          )}
          {featureType !== 'original' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadgeColors[featureType]}`}>
              {featureType === 'transformed' ? 'Transform' : 'PCA'}
            </span>
          )}
        </div>
      </div>

      <svg ref={svgRef} width={width} height={height} />

      {/* Statistics summary */}
      <div className="grid grid-cols-4 gap-2 text-base text-gray-700 mt-3 px-1">
        <div className="text-center">
          <div className="text-gray-500 text-sm">Min</div>
          <div className="font-mono font-medium">{formatValue(stats.min)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-sm">Max</div>
          <div className="font-mono font-medium">{formatValue(stats.max)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-sm">Mean (μ)</div>
          <div className="font-mono font-medium">{formatValue(stats.mean)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-sm">Std (σ)</div>
          <div className="font-mono font-medium">{formatValue(stats.std)}</div>
        </div>
      </div>
    </div>
  );
}
