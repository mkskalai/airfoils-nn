import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { PredictionPoint } from '../../stores/modelStore';
import { formatValue } from '../../utils/colors';

interface PredictionScatterplotProps {
  data: PredictionPoint[];
  title: string;
  color: string;
  height?: number;
  sharedDomain?: [number, number];
}

const MARGIN = { top: 20, right: 20, bottom: 50, left: 60 };

export function PredictionScatterplot({
  data,
  title,
  color,
  height = 280,
  sharedDomain,
}: PredictionScatterplotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    gt: number;
    pred: number;
    residual: number;
  } | null>(null);

  // Responsive width handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) {
          setContainerWidth(newWidth);
        }
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth || 400);

    return () => resizeObserver.disconnect();
  }, []);

  const width = containerWidth;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Compute scales and stats
  const { xScale, yScale, r2, rmse } = useMemo(() => {
    if (data.length === 0) {
      return {
        xScale: d3.scaleLinear().domain([0, 1]).range([0, innerWidth]),
        yScale: d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]),
        r2: null,
        rmse: null,
      };
    }

    // Use shared domain if provided, otherwise compute from data
    let domain: [number, number];
    if (sharedDomain) {
      domain = sharedDomain;
    } else {
      const allValues = data.flatMap((d) => [d.groundTruth, d.predicted]);
      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      const padding = (maxVal - minVal) * 0.05 || 0.1;
      domain = [minVal - padding, maxVal + padding];
    }

    // Calculate R^2 (coefficient of determination)
    const meanGT = d3.mean(data, (d) => d.groundTruth) || 0;
    const ssTotal = d3.sum(data, (d) => Math.pow(d.groundTruth - meanGT, 2));
    const ssRes = d3.sum(data, (d) => Math.pow(d.groundTruth - d.predicted, 2));
    const r2Value = ssTotal > 0 ? 1 - ssRes / ssTotal : 0;

    // Calculate RMSE
    const mse = d3.mean(data, (d) => Math.pow(d.groundTruth - d.predicted, 2)) || 0;
    const rmseValue = Math.sqrt(mse);

    return {
      xScale: d3.scaleLinear().domain(domain).range([0, innerWidth]).nice(),
      yScale: d3.scaleLinear().domain(domain).range([innerHeight, 0]).nice(),
      r2: r2Value,
      rmse: rmseValue,
    };
  }, [data, sharedDomain, innerWidth, innerHeight]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add grid lines
    const xGridLines = d3
      .axisBottom(xScale)
      .tickSize(-innerHeight)
      .tickFormat(() => '');

    const yGridLines = d3
      .axisLeft(yScale)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid x-grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xGridLines)
      .selectAll('line')
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    g.append('g')
      .attr('class', 'grid y-grid')
      .call(yGridLines)
      .selectAll('line')
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    g.selectAll('.grid .domain').remove();

    // Add X axis
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => formatValue(d as number, 2)));

    xAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
    xAxis.selectAll('line, path').style('stroke', '#ccc');

    // X axis label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Ground Truth');

    // Add Y axis
    const yAxis = g
      .append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => formatValue(d as number, 2)));

    yAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
    yAxis.selectAll('line, path').style('stroke', '#ccc');

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Predicted');

    // Draw y = x diagonal reference line
    const [domainMin, domainMax] = xScale.domain();
    g.append('line')
      .attr('x1', xScale(domainMin))
      .attr('y1', yScale(domainMin))
      .attr('x2', xScale(domainMax))
      .attr('y2', yScale(domainMax))
      .attr('stroke', '#999')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '8,4');

    if (data.length > 0) {
      // Draw residual lines (dotted vertical lines from point to diagonal)
      g.selectAll('.residual-line')
        .data(data)
        .enter()
        .append('line')
        .attr('class', 'residual-line')
        .attr('x1', (d) => xScale(d.groundTruth))
        .attr('y1', (d) => yScale(d.predicted))
        .attr('x2', (d) => xScale(d.groundTruth))
        .attr('y2', (d) => yScale(d.groundTruth))
        .attr('stroke', color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.4);

      // Draw data points
      g.selectAll('.point')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', (d) => xScale(d.groundTruth))
        .attr('cy', (d) => yScale(d.predicted))
        .attr('r', data.length > 500 ? 2.5 : data.length > 200 ? 3 : 4)
        .attr('fill', color)
        .attr('opacity', data.length > 200 ? 0.5 : 0.7)
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this)
            .attr('r', data.length > 500 ? 4 : data.length > 200 ? 5 : 6)
            .attr('opacity', 1);

          const [mouseX, mouseY] = d3.pointer(event, containerRef.current);
          setTooltip({
            x: mouseX,
            y: mouseY,
            gt: d.groundTruth,
            pred: d.predicted,
            residual: d.predicted - d.groundTruth,
          });
        })
        .on('mouseout', function () {
          d3.select(this)
            .attr('r', data.length > 500 ? 2.5 : data.length > 200 ? 3 : 4)
            .attr('opacity', data.length > 200 ? 0.5 : 0.7);
          setTooltip(null);
        });
    }
  }, [data, xScale, yScale, innerWidth, innerHeight, color]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Title and Stats */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        {r2 !== null && rmse !== null && (
          <div className="flex gap-3 text-xs">
            <span className="text-gray-500">
              R² = <span className="font-mono font-semibold" style={{ color }}>{formatValue(r2, 4)}</span>
            </span>
            <span className="text-gray-500">
              RMSE = <span className="font-mono font-semibold" style={{ color }}>{formatValue(rmse, 4)}</span>
            </span>
          </div>
        )}
      </div>

      <svg ref={svgRef} width={width} height={height} className="bg-white rounded-lg" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
          style={{
            left: Math.min(tooltip.x + 10, width - 140),
            top: Math.max(tooltip.y - 70, 10),
          }}
        >
          <div className="space-y-1">
            <div>
              <span className="text-gray-400">GT:</span>{' '}
              <span className="font-mono">{formatValue(tooltip.gt, 4)}</span>
            </div>
            <div>
              <span className="text-gray-400">Pred:</span>{' '}
              <span className="font-mono">{formatValue(tooltip.pred, 4)}</span>
            </div>
            <div>
              <span className="text-gray-400">Residual:</span>{' '}
              <span
                className="font-mono"
                style={{ color: tooltip.residual > 0 ? '#f87171' : '#4ade80' }}
              >
                {tooltip.residual > 0 ? '+' : ''}
                {formatValue(tooltip.residual, 4)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg
              className="w-10 h-10 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm">Start training to see predictions</p>
          </div>
        </div>
      )}
    </div>
  );
}
