import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { PCAResult } from '../../stores/featureStore';
import { useFeatureStore, TARGET_FEATURE_ID } from '../../stores/featureStore';
import { createTargetColorScale } from '../../utils/colors';
import { DownloadButton } from '../common/DownloadButton';

interface PCAScatterplotProps {
  pcaResult: PCAResult;
  width?: number;
  height?: number;
  pcX?: number;
  pcY?: number;
  colorFeatureId?: string;
  showLoadings?: boolean;
  onComponentChange?: (pcX: number, pcY: number) => void;
}

const MARGIN = { top: 40, right: 100, bottom: 50, left: 60 };

// Color palette for loading arrows
const LOADING_COLORS = [
  '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa',
  '#00acc1', '#6d4c41', '#546e7a',
];

/**
 * PCA Scatterplot
 * Shows data points projected onto selected principal components
 * with optional loading vectors overlay
 */
export function PCAScatterplot({
  pcaResult,
  width: propWidth,
  height = 350,
  pcX: propPcX,
  pcY: propPcY,
  colorFeatureId: propColorFeatureId,
  showLoadings: propShowLoadings,
  onComponentChange,
}: PCAScatterplotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 500);
  const [pcX, setPcX] = useState(propPcX ?? 0);
  const [pcY, setPcY] = useState(propPcY ?? 1);
  const [colorFeatureId, setColorFeatureId] = useState(propColorFeatureId ?? TARGET_FEATURE_ID);
  const [showLoadings, setShowLoadings] = useState(propShowLoadings ?? false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    pcXVal: number;
    pcYVal: number;
    colorVal: number;
    colorFeature: string;
  } | null>(null);

  const { features, getOriginalFeatures, getFeature } = useFeatureStore();

  // Responsive width
  useEffect(() => {
    if (propWidth) {
      setContainerWidth(propWidth);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth || 500);

    return () => resizeObserver.disconnect();
  }, [propWidth]);

  const width = containerWidth;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const { projections, components, sourceFeatureNames, numComponents, explainedVarianceRatio } = pcaResult;

  // Get color feature values
  const colorFeature = getFeature(colorFeatureId);
  const colorValues = colorFeature?.values ?? [];
  const colorFeatureName = colorFeature?.name ?? 'Target';

  // Scales
  const { xScale, yScale, colorScale } = useMemo(() => {
    const pcXValues = projections.map((p) => p[pcX] ?? 0);
    const pcYValues = projections.map((p) => p[pcY] ?? 0);

    const xMin = Math.min(...pcXValues);
    const xMax = Math.max(...pcXValues);
    const yMin = Math.min(...pcYValues);
    const yMax = Math.max(...pcYValues);

    const xPadding = (xMax - xMin) * 0.1 || 1;
    const yPadding = (yMax - yMin) * 0.1 || 1;

    const x = d3.scaleLinear()
      .domain([xMin - xPadding, xMax + xPadding])
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Color scale based on color feature
    const colorMin = colorValues.length > 0 ? Math.min(...colorValues) : 0;
    const colorMax = colorValues.length > 0 ? Math.max(...colorValues) : 1;
    const color = createTargetColorScale([colorMin, colorMax]);

    return { xScale: x, yScale: y, colorScale: color };
  }, [projections, pcX, pcY, innerWidth, innerHeight, colorValues]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
    g.append('g')
      .selectAll('line.h-grid')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    g.selectAll('line.v-grid')
      .data(xScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    // Draw data points
    const pointsG = g.append('g').attr('class', 'points');

    projections.forEach((proj, i) => {
      const cx = xScale(proj[pcX] ?? 0);
      const cy = yScale(proj[pcY] ?? 0);
      const colorVal = colorValues[i] ?? 0;

      pointsG.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 4)
        .attr('fill', colorScale(colorVal))
        .attr('opacity', 0.7)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseenter', function() {
          d3.select(this).attr('r', 6).attr('opacity', 1);
          setTooltip({
            x: cx + MARGIN.left,
            y: cy + MARGIN.top,
            pcXVal: proj[pcX] ?? 0,
            pcYVal: proj[pcY] ?? 0,
            colorVal,
            colorFeature: colorFeatureName,
          });
        })
        .on('mouseleave', function() {
          d3.select(this).attr('r', 4).attr('opacity', 0.7);
          setTooltip(null);
        });
    });

    // Draw loading vectors if enabled
    if (showLoadings && components.length > 0) {
      // Define arrow marker
      svg.append('defs').append('marker')
        .attr('id', 'scatter-arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#666');

      const loadingsX = components[pcX] ?? [];
      const loadingsY = components[pcY] ?? [];

      // Scale loadings to fit in plot
      const maxLoading = Math.max(...[...loadingsX, ...loadingsY].map(Math.abs), 0.01);
      const loadingScale = Math.min(innerWidth, innerHeight) * 0.35 / maxLoading;

      const loadingsG = g.append('g').attr('class', 'loadings');
      const centerX = innerWidth / 2;
      const centerY = innerHeight / 2;

      sourceFeatureNames.forEach((feature, fi) => {
        const lx = (loadingsX[fi] ?? 0) * loadingScale;
        const ly = -(loadingsY[fi] ?? 0) * loadingScale; // Flip y
        const color = LOADING_COLORS[fi % LOADING_COLORS.length];

        loadingsG.append('line')
          .attr('x1', centerX)
          .attr('y1', centerY)
          .attr('x2', centerX + lx)
          .attr('y2', centerY + ly)
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#scatter-arrowhead)')
          .attr('opacity', 0.8);

        // Label
        const labelX = centerX + lx * 1.1;
        const labelY = centerY + ly * 1.1;
        const shortName = feature.length > 10 ? feature.slice(0, 8) + '..' : feature;

        loadingsG.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '9px')
          .attr('font-weight', '500')
          .attr('fill', color)
          .text(shortName);
      });
    }

    // X axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('.1f')));

    xAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
    xAxis.selectAll('line, path').style('stroke', '#ccc');

    // Y axis
    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('.1f')));

    yAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
    yAxis.selectAll('line, path').style('stroke', '#ccc');

    // Axis labels with variance %
    const varXPct = ((explainedVarianceRatio[pcX] ?? 0) * 100).toFixed(1);
    const varYPct = ((explainedVarianceRatio[pcY] ?? 0) * 100).toFixed(1);

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`PC${pcX + 1} (${varXPct}% var)`);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`PC${pcY + 1} (${varYPct}% var)`);

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#374151')
      .text(`PCA Projection: PC${pcX + 1} vs PC${pcY + 1}`);

    // Color legend
    const legendWidth = 15;
    const legendHeight = innerHeight * 0.6;
    const legendX = innerWidth + 20;
    const legendY = (innerHeight - legendHeight) / 2;

    const colorDomain = colorScale.domain() as [number, number, number];
    const legendScale = d3.scaleLinear()
      .domain([colorDomain[0], colorDomain[2]])
      .range([legendHeight, 0]);

    // Legend gradient
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'scatter-color-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(colorDomain[0]));
    gradient.append('stop').attr('offset', '50%').attr('stop-color', colorScale(colorDomain[1]));
    gradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(colorDomain[2]));

    const legendG = g.append('g')
      .attr('transform', `translate(${legendX},${legendY})`);

    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#scatter-color-gradient)')
      .attr('rx', 2);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(4)
      .tickFormat(d3.format('.1f'));

    legendG.append('g')
      .attr('transform', `translate(${legendWidth},0)`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#666');

    // Legend title (truncate if needed)
    const shortColorName = colorFeatureName.length > 12
      ? colorFeatureName.slice(0, 10) + '..'
      : colorFeatureName;

    legendG.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#666')
      .text(shortColorName);

  }, [
    pcaResult, projections, components, sourceFeatureNames, explainedVarianceRatio,
    pcX, pcY, xScale, yScale, colorScale, colorValues, colorFeatureName,
    showLoadings, innerWidth, innerHeight, width,
  ]);

  // Handle component change
  const handlePcXChange = (newPcX: number) => {
    setPcX(newPcX);
    onComponentChange?.(newPcX, pcY);
  };

  const handlePcYChange = (newPcY: number) => {
    setPcY(newPcY);
    onComponentChange?.(pcX, newPcY);
  };

  // Available features for coloring (ensure unique by id)
  const colorFeatureOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [
      features[TARGET_FEATURE_ID],
      ...getOriginalFeatures(),
    ].filter(Boolean);

    return options.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  }, [features, getOriginalFeatures]);

  return (
    <div ref={containerRef} className="w-full space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Component selectors */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">X:</label>
            <select
              value={pcX}
              onChange={(e) => handlePcXChange(parseInt(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {Array.from({ length: numComponents }, (_, i) => (
                <option key={i} value={i}>
                  PC{i + 1} ({((explainedVarianceRatio[i] ?? 0) * 100).toFixed(1)}%)
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Y:</label>
            <select
              value={pcY}
              onChange={(e) => handlePcYChange(parseInt(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {Array.from({ length: numComponents }, (_, i) => (
                <option key={i} value={i}>
                  PC{i + 1} ({((explainedVarianceRatio[i] ?? 0) * 100).toFixed(1)}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Color and loading options */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Color:</label>
            <select
              value={colorFeatureId}
              onChange={(e) => setColorFeatureId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {colorFeatureOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name.length > 20 ? f.name.slice(0, 18) + '..' : f.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLoadings}
              onChange={(e) => setShowLoadings(e.target.checked)}
              className="rounded border-gray-300 text-accent focus:ring-accent w-4 h-4"
            />
            <span>Show loadings</span>
          </label>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div className="absolute top-1 right-1 z-10">
          <DownloadButton
            svgRef={svgRef}
            filename={`pca_scatterplot_PC${pcX + 1}_PC${pcY + 1}`}
            csvData={() =>
              projections.map((proj, i) => ({
                index: i + 1,
                [`PC${pcX + 1}`]: proj[pcX] ?? 0,
                [`PC${pcY + 1}`]: proj[pcY] ?? 0,
                [colorFeatureName]: colorValues[i] ?? 0,
              }))
            }
            formats={['png', 'svg', 'csv']}
          />
        </div>
        <svg ref={svgRef} width={width} height={height} className="bg-white rounded-lg" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg z-10"
            style={{
              left: Math.min(tooltip.x + 10, width - 160),
              top: tooltip.y - 10,
              transform: 'translateY(-100%)',
            }}
          >
            <div>PC{pcX + 1}: {tooltip.pcXVal.toFixed(3)}</div>
            <div>PC{pcY + 1}: {tooltip.pcYVal.toFixed(3)}</div>
            <div className="border-t border-gray-700 mt-1 pt-1">
              {tooltip.colorFeature}: {tooltip.colorVal.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
