import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { TrainingHistory } from '../../types';
import { THEME_COLORS, formatValue } from '../../utils/colors';
import { useModelStore } from '../../stores/modelStore';
import { DownloadButton } from '../common/DownloadButton';

interface LossChartProps {
  history: TrainingHistory[];
  bestValLoss: number | null;
  height?: number;
}

const MARGIN = { top: 20, right: 120, bottom: 50, left: 70 };

// Small epsilon to handle zero values in log scale
const LOG_EPSILON = 1e-10;

export function LossChart({
  history,
  bestValLoss,
  height = 280,
}: LossChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Log scale preference from store
  const logScale = useModelStore((state) => state.lossChartLogScale);
  const setLogScale = useModelStore((state) => state.setLossChartLogScale);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    epoch: number;
    loss: number;
    valLoss: number;
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
    // Initial measurement
    setContainerWidth(container.clientWidth || 600);

    return () => resizeObserver.disconnect();
  }, []);

  const width = containerWidth;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Compute scales with memoization
  const { xScale, yScale } = useMemo(() => {
    if (history.length === 0) {
      return {
        xScale: d3.scaleLinear().domain([0, 1]).range([0, innerWidth]),
        yScale: logScale
          ? d3.scaleLog().domain([LOG_EPSILON, 1]).range([innerHeight, 0])
          : d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]),
      };
    }

    const epochs = history.map((d) => d.epoch);
    const allLosses = history.flatMap((d) => [d.loss, d.valLoss]);
    const minL = Math.min(...allLosses);
    const maxL = Math.max(...allLosses);

    const xScale = d3.scaleLinear()
      .domain([0, Math.max(...epochs)])
      .range([0, innerWidth]);

    let yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;

    if (logScale) {
      // For log scale, ensure minimum is positive
      const logMin = Math.max(minL, LOG_EPSILON);
      const logMax = maxL > 0 ? maxL : 1;
      // Add small padding in log space but don't use .nice() to avoid distorted bounds
      const logPadding = Math.pow(logMax / logMin, 0.02);
      yScale = d3.scaleLog()
        .domain([logMin / logPadding, logMax * logPadding])
        .range([innerHeight, 0]);
      // Don't use .nice() for log scale as it can create ridiculous bounds
    } else {
      const padding = (maxL - minL) * 0.1 || 0.1;
      yScale = d3.scaleLinear()
        .domain([Math.max(0, minL - padding), maxL + padding])
        .range([innerHeight, 0])
        .nice();
    }

    return { xScale, yScale };
  }, [history, innerWidth, innerHeight, logScale]);

  // Line generators - handle zero values for log scale
  const trainLine = useMemo(
    () =>
      d3.line<TrainingHistory>()
        .x((d) => xScale(d.epoch))
        .y((d) => yScale(logScale ? Math.max(d.loss, LOG_EPSILON) : d.loss))
        .curve(d3.curveMonotoneX),
    [xScale, yScale, logScale]
  );

  const valLine = useMemo(
    () =>
      d3.line<TrainingHistory>()
        .x((d) => xScale(d.epoch))
        .y((d) => yScale(logScale ? Math.max(d.valLoss, LOG_EPSILON) : d.valLoss))
        .curve(d3.curveMonotoneX),
    [xScale, yScale, logScale]
  );

  // Find best validation loss point
  const bestValPoint = useMemo(() => {
    if (bestValLoss === null || history.length === 0) return null;
    return history.find((h) => h.valLoss === bestValLoss) || null;
  }, [history, bestValLoss]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add grid lines
    const xGridLines = d3.axisBottom(xScale)
      .tickSize(-innerHeight)
      .tickFormat(() => '');

    const yGridLines = d3.axisLeft(yScale)
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

    // Remove grid domain lines
    g.selectAll('.grid .domain').remove();

    // Add X axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(10, history.length || 1)));

    xAxis.selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    xAxis.selectAll('line, path')
      .style('stroke', '#ccc');

    // X axis label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('fill', '#666')
      .text('Epoch');

    // Add Y axis with appropriate ticks for log/linear scale
    const yAxisGenerator = d3.axisLeft(yScale);
    if (logScale) {
      // For log scale, use fewer ticks and scientific notation for small values
      yAxisGenerator.ticks(5, (d: number) => {
        if (d >= 0.01) return formatValue(d, 2);
        return d.toExponential(1);
      });
    } else {
      yAxisGenerator.ticks(6).tickFormat((d) => formatValue(d as number, 2));
    }
    const yAxis = g.append('g').call(yAxisGenerator);

    yAxis.selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    yAxis.selectAll('line, path')
      .style('stroke', '#ccc');

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -55)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('fill', '#666')
      .text(logScale ? 'Loss (MSE) - Log Scale' : 'Loss (MSE)');

    if (history.length > 0) {
      // Draw training loss line (solid)
      g.append('path')
        .datum(history)
        .attr('fill', 'none')
        .attr('stroke', THEME_COLORS.accent)
        .attr('stroke-width', 2.5)
        .attr('d', trainLine);

      // Draw validation loss line (dashed)
      g.append('path')
        .datum(history)
        .attr('fill', 'none')
        .attr('stroke', THEME_COLORS.warm)
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '6,4')
        .attr('d', valLine);

      // Add dots for data points (only when not too many)
      if (history.length <= 50) {
        // Training loss dots
        g.selectAll('.train-dot')
          .data(history)
          .enter()
          .append('circle')
          .attr('class', 'train-dot')
          .attr('cx', (d) => xScale(d.epoch))
          .attr('cy', (d) => yScale(logScale ? Math.max(d.loss, LOG_EPSILON) : d.loss))
          .attr('r', 3)
          .attr('fill', THEME_COLORS.accent)
          .style('cursor', 'pointer');

        // Validation loss dots
        g.selectAll('.val-dot')
          .data(history)
          .enter()
          .append('circle')
          .attr('class', 'val-dot')
          .attr('cx', (d) => xScale(d.epoch))
          .attr('cy', (d) => yScale(logScale ? Math.max(d.valLoss, LOG_EPSILON) : d.valLoss))
          .attr('r', 3)
          .attr('fill', THEME_COLORS.warm)
          .style('cursor', 'pointer');
      }

      // Best validation loss marker
      if (bestValPoint) {
        // Star marker for best val loss
        const starX = xScale(bestValPoint.epoch);
        const starY = yScale(logScale ? Math.max(bestValPoint.valLoss, LOG_EPSILON) : bestValPoint.valLoss);

        // Outer glow
        g.append('circle')
          .attr('cx', starX)
          .attr('cy', starY)
          .attr('r', 10)
          .attr('fill', 'none')
          .attr('stroke', '#22c55e')
          .attr('stroke-width', 2)
          .attr('opacity', 0.5);

        // Inner marker
        g.append('circle')
          .attr('cx', starX)
          .attr('cy', starY)
          .attr('r', 5)
          .attr('fill', '#22c55e')
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);

        // Label
        g.append('text')
          .attr('x', starX)
          .attr('y', starY - 15)
          .attr('text-anchor', 'middle')
          .style('font-size', '11px')
          .style('font-weight', 'bold')
          .style('fill', '#22c55e')
          .text(`Best: ${formatValue(bestValPoint.valLoss, 4)}`);
      }

      // Invisible overlay for tooltip
      const bisect = d3.bisector<TrainingHistory, number>((d) => d.epoch).left;

      g.append('rect')
        .attr('class', 'overlay')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mousemove', function (event) {
          const [mouseX] = d3.pointer(event);
          const x0 = xScale.invert(mouseX);
          const i = bisect(history, x0, 1);
          const d0 = history[i - 1];
          const d1 = history[i];

          if (!d0 && !d1) return;

          const d = !d1 ? d0 : !d0 ? d1 : x0 - d0.epoch > d1.epoch - x0 ? d1 : d0;

          setTooltip({
            x: xScale(d.epoch) + MARGIN.left,
            y: Math.min(yScale(d.loss), yScale(d.valLoss)) + MARGIN.top,
            epoch: d.epoch,
            loss: d.loss,
            valLoss: d.valLoss,
          });
        })
        .on('mouseleave', () => setTooltip(null));
    }

    // Legend (right side)
    const legendG = svg.append('g')
      .attr('transform', `translate(${width - MARGIN.right + 15}, ${MARGIN.top})`);

    // Training loss legend
    legendG.append('line')
      .attr('x1', 0)
      .attr('x2', 25)
      .attr('y1', 10)
      .attr('y2', 10)
      .attr('stroke', THEME_COLORS.accent)
      .attr('stroke-width', 2.5);

    legendG.append('text')
      .attr('x', 32)
      .attr('y', 10)
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Train Loss');

    // Validation loss legend
    legendG.append('line')
      .attr('x1', 0)
      .attr('x2', 25)
      .attr('y1', 35)
      .attr('y2', 35)
      .attr('stroke', THEME_COLORS.warm)
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6,4');

    legendG.append('text')
      .attr('x', 32)
      .attr('y', 35)
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Val Loss');

    // Best marker legend
    if (bestValPoint) {
      legendG.append('circle')
        .attr('cx', 12)
        .attr('cy', 60)
        .attr('r', 5)
        .attr('fill', '#22c55e')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5);

      legendG.append('text')
        .attr('x', 32)
        .attr('y', 60)
        .attr('dominant-baseline', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text('Best Val');
    }
  }, [history, xScale, yScale, trainLine, valLine, bestValPoint, innerWidth, innerHeight, width, logScale]);

  // CSV data generator for loss history
  const getLossCSVData = () =>
    history.map(h => ({
      epoch: h.epoch,
      training_loss: h.loss,
      validation_loss: h.valLoss,
    }));

  return (
    <div ref={containerRef} className="relative w-full" data-tutorial="loss-chart">
      {/* Log scale toggle - positioned above Y axis */}
      <div className="absolute top-0 left-0 z-10">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none bg-white/80 px-1 py-0.5 rounded">
          <input
            type="checkbox"
            checked={logScale}
            onChange={(e) => setLogScale(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
          />
          Log
        </label>
      </div>

      {/* Download button */}
      <div className="absolute top-2 right-2 z-10">
        <DownloadButton
          svgRef={svgRef}
          filename="loss_chart"
          csvData={getLossCSVData}
          formats={['png', 'svg', 'csv']}
        />
      </div>

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
            left: Math.min(tooltip.x + 10, width - 160),
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-semibold mb-1">Epoch {tooltip.epoch}</div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-0.5 inline-block"
              style={{ backgroundColor: THEME_COLORS.accent }}
            />
            <span>Train: {formatValue(tooltip.loss, 6)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-0.5 inline-block"
              style={{
                backgroundColor: THEME_COLORS.warm,
                borderTop: '1px dashed ' + THEME_COLORS.warm,
              }}
            />
            <span>Val: {formatValue(tooltip.valLoss, 6)}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {history.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
            <p>Training history will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
