import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { DataPoint } from '../../types';
import { FEATURE_LABELS } from '../../types';
import { createTargetColorScale, formatValue, THEME_COLORS } from '../../utils/colors';

interface PointSelectorProps {
  data: DataPoint[];
  xKey: keyof DataPoint;
  yKey: keyof DataPoint;
  width: number;
  height?: number;
  onSelectPoint: (point: DataPoint, index: number) => void;
  selectedIndex?: number | null;
  predictedValue?: number | null;
}

const MARGIN = { top: 25, right: 85, bottom: 50, left: 60 };

export function PointSelector({
  data,
  xKey,
  yKey,
  width,
  height: propHeight,
  onSelectPoint,
  selectedIndex,
  predictedValue,
}: PointSelectorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: DataPoint;
    index: number;
  } | null>(null);

  const height = propHeight ?? Math.round(width * 0.7);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const { xScale, yScale, colorScale, colorExtent } = useMemo(() => {
    const xExtent = d3.extent(data, d => d[xKey]) as [number, number];
    const yExtent = d3.extent(data, d => d[yKey]) as [number, number];
    const colorExtent = d3.extent(data, d => d.soundPressureLevel) as [number, number];

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

  useEffect(() => {
    if (!svgRef.current || innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Clip path
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'selector-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(6);

    // Grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line.horizontal')
      .data(yScale.ticks(6))
      .enter()
      .append('line')
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
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1);

    // X axis
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text').style('font-size', '12px').style('fill', '#424242');
    xAxisG.selectAll('line, path').style('stroke', '#9e9e9e');

    // Y axis
    const yAxisG = g.append('g').call(yAxis);
    yAxisG.selectAll('text').style('font-size', '12px').style('fill', '#424242');
    yAxisG.selectAll('line, path').style('stroke', '#9e9e9e');

    // Axis labels
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .style('font-size', '13px')
      .style('fill', '#424242')
      .text(FEATURE_LABELS[xKey]);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(-45,${innerHeight / 2}) rotate(-90)`)
      .style('font-size', '13px')
      .style('fill', '#424242')
      .text(FEATURE_LABELS[yKey]);

    // Points container
    const pointsG = g.append('g')
      .attr('class', 'points')
      .attr('clip-path', 'url(#selector-clip)');

    // Draw points
    pointsG.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d[xKey]))
      .attr('cy', d => yScale(d[yKey]))
      .attr('r', (_, i) => i === selectedIndex ? 8 : 4)
      .attr('fill', d => colorScale(d.soundPressureLevel))
      .attr('stroke', (_, i) => i === selectedIndex ? '#333' : '#fff')
      .attr('stroke-width', (_, i) => i === selectedIndex ? 3 : 0.5)
      .attr('opacity', (_, i) => {
        if (selectedIndex === null || selectedIndex === undefined) return 0.7;
        return i === selectedIndex ? 1 : 0.3;
      })
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        const i = data.indexOf(d);
        if (i !== selectedIndex) {
          d3.select(this)
            .attr('r', 6)
            .attr('stroke-width', 2)
            .attr('stroke', '#666');
        }

        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          data: d,
          index: i,
        });
      })
      .on('mouseleave', function(_, d) {
        const i = data.indexOf(d);
        if (i !== selectedIndex) {
          d3.select(this)
            .attr('r', 4)
            .attr('stroke-width', 0.5)
            .attr('stroke', '#fff');
        }
        setTooltip(null);
      })
      .on('click', (_, d) => {
        const i = data.indexOf(d);
        onSelectPoint(d, i);
      });

    // Color legend
    const legendHeight = innerHeight;
    const legendWidth = 16;
    const legendX = innerWidth + 20;

    const defs = svg.select('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'selector-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', THEME_COLORS.deepBlue);
    gradient.append('stop').attr('offset', '50%').attr('stop-color', THEME_COLORS.white);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', THEME_COLORS.deepOrange);

    g.append('rect')
      .attr('x', legendX)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#selector-gradient)')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('rx', 2);

    const legendScale = d3.scaleLinear().domain(colorExtent).range([legendHeight, 0]);
    const legendAxis = d3.axisRight(legendScale).ticks(5);

    g.append('g')
      .attr('transform', `translate(${legendX + legendWidth}, 0)`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#424242');

    g.select('g:last-child').selectAll('line, path').style('stroke', '#9e9e9e');

    g.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#424242')
      .text('SPL (dB)');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .translateExtent([[-100, -100], [width + 100, height + 100]])
      .on('zoom', (event) => {
        const newXScale = event.transform.rescaleX(xScale);
        const newYScale = event.transform.rescaleY(yScale);

        xAxisG.call(d3.axisBottom(newXScale).ticks(6));
        yAxisG.call(d3.axisLeft(newYScale).ticks(6));

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

    svg.on('dblclick.zoom', () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

  }, [data, xKey, yKey, xScale, yScale, colorScale, colorExtent, innerWidth, innerHeight, width, height, selectedIndex, onSelectPoint]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white rounded-lg"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-semibold mb-1">
            Data Point #{tooltip.index + 1}
            {tooltip.index === selectedIndex && <span className="text-accent ml-1">✓ Selected</span>}
          </div>
          <div className="space-y-0.5 text-gray-300">
            <div>{FEATURE_LABELS[xKey]}: <span className="text-white">{formatValue(tooltip.data[xKey])}</span></div>
            <div>{FEATURE_LABELS[yKey]}: <span className="text-white">{formatValue(tooltip.data[yKey])}</span></div>
            <div className="border-t border-gray-700 pt-1 mt-1">
              Actual SPL: <span className="text-orange-400 font-medium">{formatValue(tooltip.data.soundPressureLevel)} dB</span>
            </div>
            {selectedIndex === tooltip.index && predictedValue !== null && predictedValue !== undefined && (
              <div>
                Predicted: <span className="text-accent font-medium">{formatValue(predictedValue)} dB</span>
              </div>
            )}
          </div>
          <div className="text-gray-500 text-[10px] mt-1">Click to select</div>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Scroll to zoom, drag to pan, double-click to reset. <strong>Click</strong> on a point to use its values.
      </div>
    </div>
  );
}
