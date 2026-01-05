import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { DataPoint } from '../../types';
import { FEATURE_LABELS } from '../../types';
import { correlationMatrix } from '../../utils/stats';
import { correlationColorScale, formatValue, THEME_COLORS } from '../../utils/colors';

interface CorrelationHeatmapProps {
  data: DataPoint[];
  width: number;
  height?: number;
}

const MARGIN = { top: 100, right: 70, bottom: 20, left: 120 };

// Short labels for the matrix
const SHORT_LABELS: Record<keyof DataPoint, string> = {
  frequency: 'Frequency',
  angleOfAttack: 'Angle of Attack',
  chordLength: 'Chord Length',
  freeStreamVelocity: 'Velocity',
  suctionSideDisplacementThickness: 'SSDT',
  soundPressureLevel: 'SPL (Target)',
};

export function CorrelationHeatmap({
  data,
  width,
  height: propHeight,
}: CorrelationHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
    row: string;
    col: string;
  } | null>(null);

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = propHeight ? propHeight - MARGIN.top - MARGIN.bottom : innerWidth;
  const height = propHeight ?? (innerWidth + MARGIN.top + MARGIN.bottom);

  // Calculate correlation matrix
  const { matrix, labels } = useMemo(() => {
    return correlationMatrix(data);
  }, [data]);

  const cellSize = Math.min(innerWidth, innerHeight) / labels.length;
  const matrixSize = cellSize * labels.length;

  useEffect(() => {
    if (!svgRef.current || matrix.length === 0 || cellSize <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Create cells
    labels.forEach((rowLabel, i) => {
      labels.forEach((colLabel, j) => {
        const value = matrix[i][j];

        g.append('rect')
          .attr('x', j * cellSize)
          .attr('y', i * cellSize)
          .attr('width', cellSize - 2)
          .attr('height', cellSize - 2)
          .attr('fill', correlationColorScale(value))
          .attr('rx', 3)
          .style('cursor', 'pointer')
          .on('mouseenter', function(event) {
            d3.select(this)
              .attr('stroke', '#333')
              .attr('stroke-width', 2);

            const rect = svgRef.current!.getBoundingClientRect();
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              value,
              row: rowLabel,
              col: colLabel,
            });
          })
          .on('mouseleave', function() {
            d3.select(this)
              .attr('stroke', 'none');
            setTooltip(null);
          });

        // Add text for correlation value (always show, adjust font size based on cell)
        const fontSize = cellSize > 50 ? '14px' : cellSize > 35 ? '11px' : '9px';
        g.append('text')
          .attr('x', j * cellSize + (cellSize - 2) / 2)
          .attr('y', i * cellSize + (cellSize - 2) / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', fontSize)
          .attr('font-weight', i === j ? 'bold' : 'normal')
          .attr('fill', Math.abs(value) > 0.5 ? '#fff' : '#333')
          .style('pointer-events', 'none')
          .text(value.toFixed(2));
      });
    });

    // Add row labels (left)
    labels.forEach((label, i) => {
      g.append('text')
        .attr('x', -12)
        .attr('y', i * cellSize + (cellSize - 2) / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '15px')
        .attr('fill', label === 'soundPressureLevel' ? '#f57c00' : '#424242')
        .attr('font-weight', label === 'soundPressureLevel' ? 'bold' : 'normal')
        .text(SHORT_LABELS[label as keyof DataPoint]);
    });

    // Add column labels (top)
    labels.forEach((label, i) => {
      g.append('text')
        .attr('x', i * cellSize + (cellSize - 2) / 2)
        .attr('y', -12)
        .attr('text-anchor', 'start')
        .attr('transform', `rotate(-45, ${i * cellSize + (cellSize - 2) / 2}, -12)`)
        .attr('font-size', '15px')
        .attr('fill', label === 'soundPressureLevel' ? '#f57c00' : '#424242')
        .attr('font-weight', label === 'soundPressureLevel' ? 'bold' : 'normal')
        .text(SHORT_LABELS[label as keyof DataPoint]);
    });

    // Add color scale legend (right side, same height as matrix)
    const legendX = matrixSize + 25;
    const legendWidth = 20;

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'corr-gradient')
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
      .attr('height', matrixSize)
      .attr('fill', 'url(#corr-gradient)')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('rx', 2);

    // Legend axis
    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([matrixSize, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .tickValues([-1, -0.5, 0, 0.5, 1])
      .tickFormat(d => d.toString());

    const legendAxisG = g.append('g')
      .attr('transform', `translate(${legendX + legendWidth}, 0)`)
      .call(legendAxis);

    legendAxisG.selectAll('text')
      .style('font-size', '13px')
      .style('fill', '#424242');

    legendAxisG.selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Legend title
    g.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('fill', '#424242')
      .text('r');

  }, [matrix, labels, cellSize, matrixSize]);

  return (
    <div className="relative flex flex-col flex-1">
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
            className="absolute pointer-events-none bg-gray-900 text-white text-base rounded-lg px-3 py-2 shadow-lg z-10"
            style={{
              left: Math.min(tooltip.x + 10, width - 240),
              top: tooltip.y - 10,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-semibold mb-1">Pearson Correlation</div>
            <div className="text-gray-300 text-sm">
              <div>{FEATURE_LABELS[tooltip.row as keyof DataPoint]}</div>
              <div className="text-gray-400">vs</div>
              <div>{FEATURE_LABELS[tooltip.col as keyof DataPoint]}</div>
            </div>
            <div className="mt-2 text-xl font-bold" style={{
              color: tooltip.value > 0 ? '#fb923c' : tooltip.value < 0 ? '#60a5fa' : '#fff'
            }}>
              r = {formatValue(tooltip.value, 3)}
            </div>
          </div>
        )}
      </div>

      {/* Description - pinned to bottom */}
      <div className="mt-auto pt-3 text-base text-gray-700">
        Pearson correlation coefficients. Blue indicates negative correlation, orange indicates positive.
      </div>
    </div>
  );
}
