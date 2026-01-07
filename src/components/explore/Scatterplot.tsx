import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { DataPoint } from '../../types';
import { FEATURE_LABELS } from '../../types';
import { createTargetColorScale, formatValue, THEME_COLORS } from '../../utils/colors';
import { DownloadButton } from '../common/DownloadButton';

interface ScatterplotProps {
  data: DataPoint[];
  xKey: keyof DataPoint;
  yKey: keyof DataPoint;
  width: number;
  height?: number;
  brushedIndices?: Set<number>;
  onBrush?: (indices: Set<number>) => void;
}

const MARGIN = { top: 25, right: 85, bottom: 50, left: 60 };

export function Scatterplot({
  data,
  xKey,
  yKey,
  width,
  height: propHeight,
  brushedIndices,
  onBrush,
}: ScatterplotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: DataPoint;
  } | null>(null);

  // Calculate height based on width if not provided (aspect ratio ~0.8)
  const height = propHeight ?? Math.round(width * 0.8);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Create scales
  const { xScale, yScale, colorScale, colorExtent } = useMemo(() => {
    const xExtent = d3.extent(data, d => d[xKey]) as [number, number];
    const yExtent = d3.extent(data, d => d[yKey]) as [number, number];
    const colorExtent = d3.extent(data, d => d.soundPressureLevel) as [number, number];

    // Add padding to extent
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05;

    return {
      xScale: d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([0, innerWidth]),
      yScale: d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([innerHeight, 0]),
      colorScale: createTargetColorScale(colorExtent),
      colorExtent,
    };
  }, [data, xKey, yKey, innerWidth, innerHeight]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(svgRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add clip path for zooming
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'scatter-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Create axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(6);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line.horizontal')
      .data(yScale.ticks(6))
      .enter()
      .append('line')
      .attr('class', 'horizontal')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1);

    g.selectAll('line.vertical')
      .data(xScale.ticks(6))
      .enter()
      .append('line')
      .attr('class', 'vertical')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1);

    // Add X axis
    const xAxisG = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text')
      .style('font-size', '14px')
      .style('fill', '#424242');

    xAxisG.selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Add Y axis
    const yAxisG = g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    yAxisG.selectAll('text')
      .style('font-size', '14px')
      .style('fill', '#424242');

    yAxisG.selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Add axis labels
    g.append('text')
      .attr('class', 'x-label')
      .attr('text-anchor', 'middle')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .style('font-size', '15px')
      .style('fill', '#424242')
      .text(FEATURE_LABELS[xKey]);

    g.append('text')
      .attr('class', 'y-label')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(-50,${innerHeight / 2}) rotate(-90)`)
      .style('font-size', '15px')
      .style('fill', '#424242')
      .text(FEATURE_LABELS[yKey]);

    // Create points container with clip path
    const pointsG = g.append('g')
      .attr('class', 'points')
      .attr('clip-path', 'url(#scatter-clip)');

    // Add points
    pointsG.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d[xKey]))
      .attr('cy', d => yScale(d[yKey]))
      .attr('r', 4)
      .attr('fill', d => colorScale(d.soundPressureLevel))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('opacity', (_, i) => {
        if (!brushedIndices || brushedIndices.size === 0) return 0.7;
        return brushedIndices.has(i) ? 0.9 : 0.15;
      })
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .attr('r', 6)
          .attr('stroke-width', 2)
          .attr('stroke', '#333');

        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          data: d,
        });
      })
      .on('mouseleave', function() {
        d3.select(this)
          .attr('r', 4)
          .attr('stroke-width', 0.5)
          .attr('stroke', '#fff');
        setTooltip(null);
      });

    // Add color scale legend
    const legendHeight = innerHeight;
    const legendWidth = 18;
    const legendX = innerWidth + 25;

    // Create gradient for legend
    const defs = svg.select('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'color-scale-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', THEME_COLORS.deepBlue);

    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', THEME_COLORS.white);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', THEME_COLORS.deepOrange);

    // Legend rectangle
    g.append('rect')
      .attr('x', legendX)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#color-scale-gradient)')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('rx', 2);

    // Legend axis
    const legendScale = d3.scaleLinear()
      .domain(colorExtent)
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d => `${d}`);

    g.append('g')
      .attr('transform', `translate(${legendX + legendWidth}, 0)`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '13px')
      .style('fill', '#424242');

    g.select('g:last-child').selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Legend title
    g.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('fill', '#424242')
      .text('SPL (dB)');

    // Add brush for selection
    if (onBrush) {
      const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('end', (event) => {
          if (!event.selection) {
            onBrush(new Set());
            return;
          }

          const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
          const selected = new Set<number>();

          data.forEach((d, i) => {
            const px = xScale(d[xKey]);
            const py = yScale(d[yKey]);
            if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
              selected.add(i);
            }
          });

          onBrush(selected);
        });

      g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .translateExtent([[-100, -100], [width + 100, height + 100]])
      .on('zoom', (event) => {
        const newXScale = event.transform.rescaleX(xScale);
        const newYScale = event.transform.rescaleY(yScale);

        xAxisG.call(d3.axisBottom(newXScale).ticks(6));
        yAxisG.call(d3.axisLeft(newYScale).ticks(6));

        // Update grid lines
        g.selectAll('line.horizontal')
          .data(newYScale.ticks(6))
          .attr('y1', d => newYScale(d))
          .attr('y2', d => newYScale(d));

        g.selectAll('line.vertical')
          .data(newXScale.ticks(6))
          .attr('x1', d => newXScale(d))
          .attr('x2', d => newXScale(d));

        pointsG.selectAll('circle')
          .attr('cx', (d) => newXScale((d as DataPoint)[xKey]))
          .attr('cy', (d) => newYScale((d as DataPoint)[yKey]));
      });

    svg.call(zoom);

    // Double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);
    });

  }, [data, xKey, yKey, xScale, yScale, colorScale, colorExtent, innerWidth, innerHeight, width, height, brushedIndices, onBrush]);

  // CSV data generator for scatterplot
  const getScatterplotCSVData = () =>
    data.map((d, i) => ({
      index: i + 1,
      [FEATURE_LABELS[xKey]]: d[xKey],
      [FEATURE_LABELS[yKey]]: d[yKey],
      'Sound Pressure Level (dB)': d.soundPressureLevel,
    }));

  return (
    <div className="relative flex flex-col flex-1">
      <div className="absolute top-1 right-1 z-10">
        <DownloadButton
          svgRef={svgRef}
          filename={`scatterplot_${String(xKey)}_vs_${String(yKey)}`}
          csvData={getScatterplotCSVData}
          formats={['png', 'svg', 'csv']}
        />
      </div>
      <div className="flex-1">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="bg-white rounded-lg"
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg z-10"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y - 10,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-semibold mb-1">Data Point</div>
            <div className="space-y-0.5 text-gray-300">
              <div>{FEATURE_LABELS[xKey]}: <span className="text-white">{formatValue(tooltip.data[xKey])}</span></div>
              <div>{FEATURE_LABELS[yKey]}: <span className="text-white">{formatValue(tooltip.data[yKey])}</span></div>
              <div className="border-t border-gray-700 pt-1 mt-1">
                Sound Pressure: <span className="text-orange-400 font-medium">{formatValue(tooltip.data.soundPressureLevel)} dB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions - pinned to bottom */}
      <div className="mt-auto pt-3 text-base text-gray-700">
        Scroll to zoom, drag to pan, double-click to reset. Drag a rectangle to select points.
      </div>
    </div>
  );
}
