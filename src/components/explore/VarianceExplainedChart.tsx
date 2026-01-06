import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { PCAResult } from '../../stores/featureStore';
import { THEME_COLORS } from '../../utils/colors';

interface VarianceExplainedChartProps {
  pcaResult: PCAResult;
  width?: number;
  height?: number;
  showThreshold?: boolean;
  thresholdValue?: number;
}

const MARGIN = { top: 30, right: 60, bottom: 50, left: 60 };

/**
 * Variance Explained Chart
 * Interactive D3 chart showing individual and cumulative variance explained by PCA components
 */
export function VarianceExplainedChart({
  pcaResult,
  width: propWidth,
  height = 280,
  showThreshold = true,
  thresholdValue = 0.95,
}: VarianceExplainedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 500);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    componentIndex: number;
    individual: number;
    cumulative: number;
  } | null>(null);

  // Responsive width handling
  useEffect(() => {
    if (propWidth) {
      setContainerWidth(propWidth);
      return;
    }

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
    setContainerWidth(container.clientWidth || 500);

    return () => resizeObserver.disconnect();
  }, [propWidth]);

  const width = containerWidth;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Data
  const { explainedVarianceRatio, cumulativeVarianceRatio, numComponents } = pcaResult;

  // Scales
  const { xScale, yScale } = useMemo(() => {
    const x = d3.scaleBand()
      .domain(Array.from({ length: numComponents }, (_, i) => `PC${i + 1}`))
      .range([0, innerWidth])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0])
      .nice();

    return { xScale: x, yScale: y };
  }, [numComponents, innerWidth, innerHeight]);

  // Find component where cumulative crosses threshold
  const thresholdComponent = useMemo(() => {
    if (!showThreshold) return null;
    for (let i = 0; i < cumulativeVarianceRatio.length; i++) {
      if (cumulativeVarianceRatio[i] >= thresholdValue) {
        return i;
      }
    }
    return null;
  }, [cumulativeVarianceRatio, showThreshold, thresholdValue]);

  // Line generator for cumulative variance
  const cumulativeLine = useMemo(() => {
    return d3.line<number>()
      .x((_, i) => (xScale(`PC${i + 1}`) ?? 0) + xScale.bandwidth() / 2)
      .y((d) => yScale(d))
      .curve(d3.curveMonotoneX);
  }, [xScale, yScale]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
    const yGridLines = d3.axisLeft(yScale)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .call(yGridLines)
      .selectAll('line')
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    g.selectAll('.grid .domain').remove();

    // Threshold line
    if (showThreshold) {
      const thresholdY = yScale(thresholdValue);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', thresholdY)
        .attr('y2', thresholdY)
        .attr('stroke', '#22c55e')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,3');

      g.append('text')
        .attr('x', innerWidth + 5)
        .attr('y', thresholdY + 4)
        .attr('font-size', '11px')
        .attr('fill', '#22c55e')
        .attr('font-weight', 'bold')
        .text(`${(thresholdValue * 100).toFixed(0)}%`);
    }

    // Bars for individual variance
    g.selectAll('.var-bar')
      .data(explainedVarianceRatio)
      .enter()
      .append('rect')
      .attr('class', 'var-bar')
      .attr('x', (_, i) => xScale(`PC${i + 1}`) ?? 0)
      .attr('y', (d) => yScale(d))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d))
      .attr('fill', THEME_COLORS.accent)
      .attr('fill-opacity', 0.7)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(_event, d) {
        d3.select(this).attr('fill-opacity', 1);
        const i = explainedVarianceRatio.indexOf(d);
        const barX = (xScale(`PC${i + 1}`) ?? 0) + xScale.bandwidth() / 2;
        setTooltip({
          x: barX + MARGIN.left,
          y: yScale(d) + MARGIN.top - 10,
          componentIndex: i,
          individual: d,
          cumulative: cumulativeVarianceRatio[i],
        });
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill-opacity', 0.7);
        setTooltip(null);
      });

    // Value labels on bars
    g.selectAll('.bar-label')
      .data(explainedVarianceRatio)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', (_, i) => (xScale(`PC${i + 1}`) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('font-weight', '500')
      .text((d) => `${(d * 100).toFixed(1)}%`);

    // Cumulative variance line
    g.append('path')
      .datum(cumulativeVarianceRatio)
      .attr('fill', 'none')
      .attr('stroke', THEME_COLORS.warm)
      .attr('stroke-width', 2.5)
      .attr('d', cumulativeLine);

    // Cumulative dots
    g.selectAll('.cum-dot')
      .data(cumulativeVarianceRatio)
      .enter()
      .append('circle')
      .attr('class', 'cum-dot')
      .attr('cx', (_, i) => (xScale(`PC${i + 1}`) ?? 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d))
      .attr('r', 5)
      .attr('fill', THEME_COLORS.warm)
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function(_event, d) {
        d3.select(this).attr('r', 7);
        const i = cumulativeVarianceRatio.indexOf(d);
        const dotX = (xScale(`PC${i + 1}`) ?? 0) + xScale.bandwidth() / 2;
        setTooltip({
          x: dotX + MARGIN.left,
          y: yScale(d) + MARGIN.top - 10,
          componentIndex: i,
          individual: explainedVarianceRatio[i],
          cumulative: d,
        });
      })
      .on('mouseleave', function() {
        d3.select(this).attr('r', 5);
        setTooltip(null);
      });

    // Highlight threshold crossing point
    if (thresholdComponent !== null) {
      const crossX = (xScale(`PC${thresholdComponent + 1}`) ?? 0) + xScale.bandwidth() / 2;
      const crossY = yScale(cumulativeVarianceRatio[thresholdComponent]);

      g.append('circle')
        .attr('cx', crossX)
        .attr('cy', crossY)
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', '#22c55e')
        .attr('stroke-width', 2)
        .attr('opacity', 0.7);
    }

    // X axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    xAxis.selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#666');

    xAxis.selectAll('line, path')
      .style('stroke', '#ccc');

    // Y axis
    const yAxis = g.append('g')
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`)
      );

    yAxis.selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#666');

    yAxis.selectAll('line, path')
      .style('stroke', '#ccc');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Principal Component');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Variance Explained');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#374151')
      .text('Explained Variance by Component');

  }, [
    pcaResult,
    explainedVarianceRatio,
    cumulativeVarianceRatio,
    xScale,
    yScale,
    cumulativeLine,
    showThreshold,
    thresholdValue,
    thresholdComponent,
    innerWidth,
    innerHeight,
    width,
  ]);

  return (
    <div ref={containerRef} className="relative w-full">
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
            left: Math.min(tooltip.x, width - 150),
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold mb-1">PC{tooltip.componentIndex + 1}</div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: THEME_COLORS.accent }}
            />
            <span>Individual: {(tooltip.individual * 100).toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: THEME_COLORS.warm }}
            />
            <span>Cumulative: {(tooltip.cumulative * 100).toFixed(2)}%</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: THEME_COLORS.accent, opacity: 0.7 }}
          />
          <span>Individual variance</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-0.5 rounded"
            style={{ backgroundColor: THEME_COLORS.warm }}
          />
          <div
            className="w-2 h-2 rounded-full -ml-3"
            style={{ backgroundColor: THEME_COLORS.warm }}
          />
          <span className="ml-1">Cumulative</span>
        </div>
        {showThreshold && (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-0.5"
              style={{
                backgroundColor: '#22c55e',
                borderTop: '1px dashed #22c55e',
              }}
            />
            <span>{(thresholdValue * 100).toFixed(0)}% threshold</span>
          </div>
        )}
      </div>
    </div>
  );
}
