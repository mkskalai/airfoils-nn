import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { PCAResult } from '../../stores/featureStore';
import { DownloadButton } from '../common/DownloadButton';

interface PCALoadingsChartProps {
  pcaResult: PCAResult;
  width?: number;
  height?: number;
  view?: 'biplot' | 'heatmap';
  pcX?: number; // Component index for X axis (0-based)
  pcY?: number; // Component index for Y axis (0-based)
  onViewChange?: (view: 'biplot' | 'heatmap') => void;
  onComponentChange?: (pcX: number, pcY: number) => void;
}

const MARGIN_BIPLOT = { top: 40, right: 40, bottom: 50, left: 60 };
const MARGIN_HEATMAP = { top: 40, right: 120, bottom: 80, left: 140 };

// Color palette for feature arrows in biplot
const FEATURE_COLORS = [
  '#e53935', // Red
  '#1e88e5', // Blue
  '#43a047', // Green
  '#fb8c00', // Orange
  '#8e24aa', // Purple
  '#00acc1', // Cyan
  '#6d4c41', // Brown
  '#546e7a', // Blue Grey
];

/**
 * PCA Loadings Biplot
 * Shows loading vectors as arrows from origin for 2 selected components
 */
function Biplot({
  pcaResult,
  width,
  height,
  pcX,
  pcY,
}: {
  pcaResult: PCAResult;
  width: number;
  height: number;
  pcX: number;
  pcY: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    feature: string;
    loadingX: number;
    loadingY: number;
  } | null>(null);

  const innerWidth = width - MARGIN_BIPLOT.left - MARGIN_BIPLOT.right;
  const innerHeight = height - MARGIN_BIPLOT.top - MARGIN_BIPLOT.bottom;

  const { components, sourceFeatureNames } = pcaResult;

  // Get loadings for selected components
  const loadingsX = components[pcX] || [];
  const loadingsY = components[pcY] || [];

  // Calculate scale based on max loading magnitude
  const maxLoading = useMemo(() => {
    const allLoadings = [...loadingsX, ...loadingsY].map(Math.abs);
    return Math.max(...allLoadings, 0.01);
  }, [loadingsX, loadingsY]);

  // Scales
  const { xScale, yScale } = useMemo(() => {
    const padding = maxLoading * 0.15;
    const domain = [-maxLoading - padding, maxLoading + padding];

    return {
      xScale: d3.scaleLinear().domain(domain).range([0, innerWidth]),
      yScale: d3.scaleLinear().domain(domain).range([innerHeight, 0]),
    };
  }, [maxLoading, innerWidth, innerHeight]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN_BIPLOT.left},${MARGIN_BIPLOT.top})`);

    // Define arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line.h-grid')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'h-grid')
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
      .attr('class', 'v-grid')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    // Origin lines (axes through 0)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#999')
      .attr('stroke-width', 1);

    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#999')
      .attr('stroke-width', 1);

    // Draw loading vectors as arrows
    sourceFeatureNames.forEach((feature, i) => {
      const lx = loadingsX[i] || 0;
      const ly = loadingsY[i] || 0;
      const color = FEATURE_COLORS[i % FEATURE_COLORS.length];

      const x0 = xScale(0);
      const y0 = yScale(0);
      const x1 = xScale(lx);
      const y1 = yScale(ly);

      // Arrow line
      g.append('line')
        .attr('x1', x0)
        .attr('y1', y0)
        .attr('x2', x1)
        .attr('y2', y1)
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('marker-end', 'url(#arrowhead)')
        .style('cursor', 'pointer')
        .on('mouseenter', function() {
          d3.select(this).attr('stroke-width', 4);
          setTooltip({
            x: x1 + MARGIN_BIPLOT.left,
            y: y1 + MARGIN_BIPLOT.top,
            feature,
            loadingX: lx,
            loadingY: ly,
          });
        })
        .on('mouseleave', function() {
          d3.select(this).attr('stroke-width', 2.5);
          setTooltip(null);
        });

      // Feature label at arrow tip
      const labelOffset = 12;
      const angle = Math.atan2(ly, lx);
      const labelX = x1 + Math.cos(angle) * labelOffset;
      const labelY = y1 - Math.sin(angle) * labelOffset;

      // Abbreviate long names
      const shortName = feature.length > 12 ? feature.slice(0, 10) + '...' : feature;

      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', lx >= 0 ? 'start' : 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .attr('fill', color)
        .text(shortName)
        .style('cursor', 'pointer')
        .on('mouseenter', () => {
          setTooltip({
            x: x1 + MARGIN_BIPLOT.left,
            y: y1 + MARGIN_BIPLOT.top,
            feature,
            loadingX: lx,
            loadingY: ly,
          });
        })
        .on('mouseleave', () => setTooltip(null));
    });

    // X axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('.2f')));

    xAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
    xAxis.selectAll('line, path').style('stroke', '#ccc');

    // Y axis
    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.2f')));

    yAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
    yAxis.selectAll('line, path').style('stroke', '#ccc');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`PC${pcX + 1} Loading`);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`PC${pcY + 1} Loading`);

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#374151')
      .text(`Loading Vectors: PC${pcX + 1} vs PC${pcY + 1}`);

  }, [pcaResult, loadingsX, loadingsY, xScale, yScale, innerWidth, innerHeight, width, pcX, pcY, sourceFeatureNames]);

  // CSV data generator for biplot loadings
  const getBiplotCSVData = () =>
    sourceFeatureNames.map((feature, i) => ({
      feature,
      [`PC${pcX + 1}_loading`]: loadingsX[i] || 0,
      [`PC${pcY + 1}_loading`]: loadingsY[i] || 0,
      magnitude: Math.sqrt((loadingsX[i] || 0) ** 2 + (loadingsY[i] || 0) ** 2),
    }));

  return (
    <div className="relative">
      <div className="absolute top-1 right-1 z-10">
        <DownloadButton
          svgRef={svgRef}
          filename={`pca_biplot_PC${pcX + 1}_PC${pcY + 1}`}
          csvData={getBiplotCSVData}
          formats={['png', 'svg', 'csv']}
        />
      </div>
      <svg ref={svgRef} width={width} height={height} className="bg-white rounded-lg" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg z-10"
          style={{
            left: Math.min(tooltip.x + 10, width - 180),
            top: Math.max(tooltip.y - 10, 10),
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-semibold mb-1">{tooltip.feature}</div>
          <div>PC{pcX + 1}: {tooltip.loadingX.toFixed(4)}</div>
          <div>PC{pcY + 1}: {tooltip.loadingY.toFixed(4)}</div>
          <div className="text-gray-300 text-xs mt-1">
            Magnitude: {Math.sqrt(tooltip.loadingX ** 2 + tooltip.loadingY ** 2).toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PCA Loadings Heatmap
 * Shows all loadings as a color-coded matrix
 */
function Heatmap({
  pcaResult,
  width,
  height,
}: {
  pcaResult: PCAResult;
  width: number;
  height: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    feature: string;
    component: number;
    loading: number;
  } | null>(null);

  const innerWidth = width - MARGIN_HEATMAP.left - MARGIN_HEATMAP.right;
  const innerHeight = height - MARGIN_HEATMAP.top - MARGIN_HEATMAP.bottom;

  const { components, sourceFeatureNames, numComponents } = pcaResult;

  // Scales
  const { xScale, yScale, colorScale } = useMemo(() => {
    const x = d3.scaleBand()
      .domain(Array.from({ length: numComponents }, (_, i) => `PC${i + 1}`))
      .range([0, innerWidth])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(sourceFeatureNames)
      .range([0, innerHeight])
      .padding(0.05);

    // Find max absolute loading for color scale
    const maxAbs = Math.max(...components.flat().map(Math.abs), 0.01);

    const color = d3.scaleDiverging<string>()
      .domain([-maxAbs, 0, maxAbs])
      .interpolator(d3.interpolateRdBu);

    return { xScale: x, yScale: y, colorScale: color };
  }, [numComponents, sourceFeatureNames, innerWidth, innerHeight, components]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN_HEATMAP.left},${MARGIN_HEATMAP.top})`);

    // Draw cells
    components.forEach((componentLoadings, ci) => {
      componentLoadings.forEach((loading, fi) => {
        const feature = sourceFeatureNames[fi];
        const cellWidth = xScale.bandwidth();
        const cellHeight = yScale.bandwidth();
        const x = xScale(`PC${ci + 1}`) ?? 0;
        const y = yScale(feature) ?? 0;

        g.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .attr('fill', colorScale(loading))
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('mouseenter', function() {
            d3.select(this).attr('stroke', '#333').attr('stroke-width', 2);
            setTooltip({
              x: x + cellWidth / 2 + MARGIN_HEATMAP.left,
              y: y + MARGIN_HEATMAP.top,
              feature,
              component: ci,
              loading,
            });
          })
          .on('mouseleave', function() {
            d3.select(this).attr('stroke', 'none');
            setTooltip(null);
          });

        // Show loading value in cell
        if (cellWidth > 30 && cellHeight > 20) {
          g.append('text')
            .attr('x', x + cellWidth / 2)
            .attr('y', y + cellHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('fill', Math.abs(loading) > 0.5 ? 'white' : '#333')
            .attr('pointer-events', 'none')
            .text(loading.toFixed(2));
        }
      });
    });

    // X axis (components)
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    xAxis.selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#666');

    xAxis.selectAll('line, path').style('stroke', '#ccc');

    // Y axis (features)
    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale));

    yAxis.selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#666')
      .each(function() {
        const text = d3.select(this);
        const fullText = text.text();
        if (fullText.length > 18) {
          text.text(fullText.slice(0, 16) + '...');
          text.append('title').text(fullText);
        }
      });

    yAxis.selectAll('line, path').style('stroke', '#ccc');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#374151')
      .text('Loading Matrix');

    // Color legend
    const legendWidth = 15;
    const legendHeight = innerHeight;
    const legendX = innerWidth + 20;

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain() as [number, number, number])
      .range([legendHeight, legendHeight / 2, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d3.format('.2f'));

    // Legend gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'loading-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    const domain = colorScale.domain() as number[];
    gradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(domain[0]));
    gradient.append('stop').attr('offset', '50%').attr('stop-color', colorScale(domain[1]));
    gradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(domain[2]));

    const legendG = g.append('g')
      .attr('transform', `translate(${legendX},0)`);

    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#loading-gradient)')
      .attr('rx', 2);

    legendG.append('g')
      .attr('transform', `translate(${legendWidth},0)`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#666');

    legendG.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#666')
      .text('Loading');

  }, [pcaResult, components, sourceFeatureNames, xScale, yScale, colorScale, innerWidth, innerHeight, width]);

  // CSV data generator for heatmap loadings
  const getHeatmapCSVData = () =>
    sourceFeatureNames.map((feature, fi) => {
      const row: Record<string, unknown> = { feature };
      components.forEach((comp, ci) => {
        row[`PC${ci + 1}`] = comp[fi];
      });
      return row;
    });

  return (
    <div className="relative">
      <div className="absolute top-1 right-1 z-10">
        <DownloadButton
          svgRef={svgRef}
          filename="pca_loadings_heatmap"
          csvData={getHeatmapCSVData}
          formats={['png', 'svg', 'csv']}
        />
      </div>
      <svg ref={svgRef} width={width} height={height} className="bg-white rounded-lg" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg z-10"
          style={{
            left: Math.min(tooltip.x + 10, width - 180),
            top: tooltip.y,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="font-semibold mb-1">{tooltip.feature}</div>
          <div>PC{tooltip.component + 1}: {tooltip.loading.toFixed(4)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * PCA Loadings Chart
 * Container component with view toggle (biplot vs heatmap) and component selectors
 */
export function PCALoadingsChart({
  pcaResult,
  width: propWidth,
  height = 350,
  view: propView,
  pcX: propPcX,
  pcY: propPcY,
  onViewChange,
  onComponentChange,
}: PCALoadingsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 500);
  const [internalView, setInternalView] = useState<'biplot' | 'heatmap'>(propView ?? 'biplot');
  const [internalPcX, setInternalPcX] = useState(propPcX ?? 0);
  const [internalPcY, setInternalPcY] = useState(propPcY ?? 1);

  const view = propView ?? internalView;
  const pcX = propPcX ?? internalPcX;
  const pcY = propPcY ?? internalPcY;

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
  const { numComponents } = pcaResult;

  const handleViewChange = (newView: 'biplot' | 'heatmap') => {
    setInternalView(newView);
    onViewChange?.(newView);
  };

  const handlePcXChange = (newPcX: number) => {
    setInternalPcX(newPcX);
    onComponentChange?.(newPcX, pcY);
  };

  const handlePcYChange = (newPcY: number) => {
    setInternalPcY(newPcY);
    onComponentChange?.(pcX, newPcY);
  };

  return (
    <div ref={containerRef} className="w-full space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* View toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">View:</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => handleViewChange('biplot')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                view === 'biplot'
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Biplot
            </button>
            <button
              onClick={() => handleViewChange('heatmap')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                view === 'heatmap'
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Heatmap
            </button>
          </div>
        </div>

        {/* Component selectors (only for biplot) */}
        {view === 'biplot' && numComponents >= 2 && (
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
                    PC{i + 1}
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
                    PC{i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {view === 'biplot' ? (
        <Biplot pcaResult={pcaResult} width={width} height={height} pcX={pcX} pcY={pcY} />
      ) : (
        <Heatmap pcaResult={pcaResult} width={width} height={height} />
      )}
    </div>
  );
}
