import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useFeatureStore, TARGET_FEATURE_ID } from '../../stores/featureStore';
import type { FeatureDefinition } from '../../stores/featureStore';
import { createTargetColorScale, formatValue, THEME_COLORS } from '../../utils/colors';
import { DownloadButton } from '../common/DownloadButton';

interface ScatterplotMatrixProps {
  /** Width of the entire matrix */
  width: number;
  /** Feature IDs to include in the matrix */
  featureIds: string[];
  /** Brushed point indices for linked selection */
  brushedIndices?: Set<number>;
  /** Callback when brushing changes */
  onBrush?: (indices: Set<number>) => void;
  /** Maximum points to render (subsampling for performance) */
  maxPoints?: number;
}

const PADDING = { outer: 50, cellGap: 8 };
const AXIS_TICKS = 4;

/**
 * Get short display label for features
 */
function getShortLabel(name: string): string {
  const abbreviations: Record<string, string> = {
    'Frequency (Hz)': 'Frequency',
    'Angle of Attack (deg)': 'Angle of Attack',
    'Chord Length (m)': 'Chord Length',
    'Free-stream Velocity (m/s)': 'Velocity',
    'Suction Side Displacement Thickness (m)': 'SSDT',
    'Sound Pressure Level (dB)': 'SPL',
  };

  if (abbreviations[name]) {
    return abbreviations[name];
  }

  if (name.startsWith('PC')) {
    return name.split(' ')[0];
  }

  return name;
}

/**
 * Format tick value for axis labels
 */
function formatTickValue(value: number): string {
  const absVal = Math.abs(value);
  if (absVal === 0) return '0';
  if (absVal >= 10000) {
    return (value / 1000).toFixed(0) + 'k';
  }
  if (absVal >= 100) {
    return value.toFixed(0);
  }
  if (absVal >= 1) {
    return value.toFixed(1);
  }
  if (absVal >= 0.01) {
    return value.toFixed(2);
  }
  return value.toExponential(0);
}

/**
 * Subsample data indices for performance
 */
function subsampleIndices(totalLength: number, maxPoints: number): number[] {
  if (totalLength <= maxPoints) {
    return Array.from({ length: totalLength }, (_, i) => i);
  }

  const step = totalLength / maxPoints;
  const indices: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    indices.push(Math.floor(i * step));
  }
  return indices;
}

export function ScatterplotMatrix({
  width,
  featureIds,
  brushedIndices,
  onBrush,
  maxPoints = 500,
}: ScatterplotMatrixProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: Record<string, number | string>;
  } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const { features } = useFeatureStore();

  // Get feature definitions for selected IDs
  const selectedFeatures = useMemo(() => {
    return featureIds
      .map(id => features[id])
      .filter((f): f is FeatureDefinition => f !== undefined);
  }, [featureIds, features]);

  // Get target feature for coloring
  const targetFeature = features[TARGET_FEATURE_ID];
  const targetValues = targetFeature?.values ?? [];
  const targetExtent = useMemo(() => {
    if (targetValues.length === 0) return [0, 1] as [number, number];
    return d3.extent(targetValues) as [number, number];
  }, [targetValues]);
  const colorScale = useMemo(() => createTargetColorScale(targetExtent), [targetExtent]);

  // For n features, we create (n-1) x (n-1) grid
  // X-axis features: features[0] to features[n-2]
  // Y-axis features: features[1] to features[n-1]
  const numFeatures = selectedFeatures.length;
  const gridSize = Math.max(1, numFeatures - 1);

  // X-axis features (columns): all except last
  const xFeatures = useMemo(() => selectedFeatures.slice(0, -1), [selectedFeatures]);
  // Y-axis features (rows): all except first
  const yFeatures = useMemo(() => selectedFeatures.slice(1), [selectedFeatures]);

  // Calculate cell size based on grid dimensions
  const availableWidth = width - PADDING.outer * 2;
  const totalGaps = (gridSize - 1) * PADDING.cellGap;
  const cellSize = gridSize > 0 ? (availableWidth - totalGaps) / gridSize : availableWidth;
  const matrixWidth = gridSize * cellSize + (gridSize - 1) * PADDING.cellGap;
  const height = matrixWidth + PADDING.outer * 2;

  // Subsample indices for performance
  const dataLength = selectedFeatures[0]?.values.length ?? 0;
  const sampledIndices = useMemo(
    () => subsampleIndices(dataLength, maxPoints),
    [dataLength, maxPoints]
  );

  // Create scales for each feature (shared across all cells using that feature)
  const xScales = useMemo(() => {
    return xFeatures.map(feature => {
      const padding = (feature.stats.max - feature.stats.min) * 0.05;
      return d3.scaleLinear()
        .domain([feature.stats.min - padding, feature.stats.max + padding])
        .range([0, cellSize]);
    });
  }, [xFeatures, cellSize]);

  const yScales = useMemo(() => {
    return yFeatures.map(feature => {
      const padding = (feature.stats.max - feature.stats.min) * 0.05;
      return d3.scaleLinear()
        .domain([feature.stats.min - padding, feature.stats.max + padding])
        .range([cellSize, 0]);
    });
  }, [yFeatures, cellSize]);

  // Handle brush selection
  const handleBrushEnd = useCallback(
    (
      xFeature: FeatureDefinition,
      yFeature: FeatureDefinition,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>,
      selection: [[number, number], [number, number]] | null
    ) => {
      if (!onBrush) return;

      if (!selection) {
        onBrush(new Set());
        return;
      }

      const [[x0, y0], [x1, y1]] = selection;
      const selected = new Set<number>();

      const xValues = xFeature.values;
      const yValues = yFeature.values;

      for (let i = 0; i < xValues.length; i++) {
        const px = xScale(xValues[i]);
        const py = yScale(yValues[i]);
        if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
          selected.add(i);
        }
      }

      onBrush(selected);
    },
    [onBrush]
  );

  // Handle point click for highlighting
  const handlePointClick = useCallback((index: number) => {
    setHighlightedIndex(prev => prev === index ? null : index);
  }, []);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || selectedFeatures.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${PADDING.outer},${PADDING.outer})`);

    // Render cells - only lower triangle (row >= col in the reduced grid)
    yFeatures.forEach((yFeature, row) => {
      xFeatures.forEach((xFeature, col) => {
        // Only render if row >= col (lower triangle including diagonal)
        if (row < col) return;

        const xOffset = col * (cellSize + PADDING.cellGap);
        const yOffset = row * (cellSize + PADDING.cellGap);

        const cellG = g.append('g')
          .attr('transform', `translate(${xOffset},${yOffset})`);

        const xScale = xScales[col];
        const yScale = yScales[row];

        // Cell background
        cellG.append('rect')
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('fill', '#fafafa')
          .attr('stroke', '#e0e0e0')
          .attr('stroke-width', 1)
          .attr('rx', 2);

        // Get tick values
        const xTicks = xScale.ticks(AXIS_TICKS);
        const yTicks = yScale.ticks(AXIS_TICKS);

        // Draw grid lines
        const gridGroup = cellG.append('g').attr('class', 'grid');

        // Vertical grid lines
        gridGroup.selectAll('.grid-x')
          .data(xTicks)
          .enter()
          .append('line')
          .attr('x1', d => xScale(d))
          .attr('x2', d => xScale(d))
          .attr('y1', 0)
          .attr('y2', cellSize)
          .attr('stroke', '#e8e8e8')
          .attr('stroke-width', 1);

        // Horizontal grid lines
        gridGroup.selectAll('.grid-y')
          .data(yTicks)
          .enter()
          .append('line')
          .attr('x1', 0)
          .attr('x2', cellSize)
          .attr('y1', d => yScale(d))
          .attr('y2', d => yScale(d))
          .attr('stroke', '#e8e8e8')
          .attr('stroke-width', 1);

        // Add brush BEFORE points so points are clickable (rendered on top)
        if (onBrush) {
          const brush = d3.brush()
            .extent([[0, 0], [cellSize, cellSize]])
            .on('end', (event) => {
              handleBrushEnd(
                xFeature,
                yFeature,
                xScale,
                yScale,
                event.selection as [[number, number], [number, number]] | null
              );
            });

          cellG.append('g')
            .attr('class', 'brush')
            .call(brush)
            .selectAll('.overlay')
            .style('cursor', 'crosshair');
        }

        // Draw points
        const xValues = xFeature.values;
        const yValues = yFeature.values;
        const baseRadius = Math.max(2, Math.min(4, cellSize / 60));

        // Separate points into layers for proper z-ordering
        const nonBrushedPoints: number[] = [];
        const brushedPoints: number[] = [];
        const highlightedPoint: number | null = highlightedIndex !== null && sampledIndices.includes(highlightedIndex) ? highlightedIndex : null;

        sampledIndices.forEach(i => {
          if (i === highlightedIndex) return; // Handle highlighted separately (render last)
          const isBrushed = !brushedIndices || brushedIndices.size === 0 || brushedIndices.has(i);
          if (isBrushed) {
            brushedPoints.push(i);
          } else {
            nonBrushedPoints.push(i);
          }
        });

        // Render non-brushed points first (bottom layer) - very faded
        nonBrushedPoints.forEach(i => {
          const px = xScale(xValues[i]);
          const py = yScale(yValues[i]);

          cellG.append('circle')
            .attr('cx', px)
            .attr('cy', py)
            .attr('r', baseRadius * 0.7)
            .attr('fill', colorScale(targetValues[i] ?? 0))
            .attr('stroke', 'none')
            .attr('opacity', 0.12)
            .style('cursor', 'pointer')
            .on('click', function (event) {
              event.stopPropagation();
              handlePointClick(i);
            })
            .on('mouseenter', function (event) {
              d3.select(this)
                .attr('r', baseRadius + 1)
                .attr('opacity', 0.6)
                .attr('stroke', '#666')
                .attr('stroke-width', 1);
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                data: {
                  [xFeature.name]: xValues[i],
                  [yFeature.name]: yValues[i],
                  'SPL (dB)': targetValues[i] ?? 0,
                },
              });
            })
            .on('mouseleave', function () {
              d3.select(this)
                .attr('r', baseRadius * 0.7)
                .attr('opacity', 0.12)
                .attr('stroke', 'none');
              setTooltip(null);
            });
        });

        // Render brushed points (middle layer) - full color with subtle stroke
        brushedPoints.forEach(i => {
          const px = xScale(xValues[i]);
          const py = yScale(yValues[i]);

          cellG.append('circle')
            .attr('cx', px)
            .attr('cy', py)
            .attr('r', baseRadius)
            .attr('fill', colorScale(targetValues[i] ?? 0))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.85)
            .style('cursor', 'pointer')
            .on('click', function (event) {
              event.stopPropagation();
              handlePointClick(i);
            })
            .on('mouseenter', function (event) {
              d3.select(this)
                .attr('r', baseRadius + 2)
                .attr('stroke-width', 1.5)
                .attr('stroke', '#333');
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                data: {
                  [xFeature.name]: xValues[i],
                  [yFeature.name]: yValues[i],
                  'SPL (dB)': targetValues[i] ?? 0,
                },
              });
            })
            .on('mouseleave', function () {
              d3.select(this)
                .attr('r', baseRadius)
                .attr('stroke-width', 0.5)
                .attr('stroke', '#fff');
              setTooltip(null);
            });
        });

        // Render highlighted point last (top layer) - very prominent
        if (highlightedPoint !== null) {
          const i = highlightedPoint;
          const px = xScale(xValues[i]);
          const py = yScale(yValues[i]);

          // Outer glow ring
          cellG.append('circle')
            .attr('cx', px)
            .attr('cy', py)
            .attr('r', baseRadius + 8)
            .attr('fill', 'none')
            .attr('stroke', THEME_COLORS.accent)
            .attr('stroke-width', 2)
            .attr('opacity', 0.4)
            .style('pointer-events', 'none');

          // Main highlighted point
          cellG.append('circle')
            .attr('cx', px)
            .attr('cy', py)
            .attr('r', baseRadius + 4)
            .attr('fill', colorScale(targetValues[i] ?? 0))
            .attr('stroke', '#000')
            .attr('stroke-width', 2.5)
            .attr('opacity', 1)
            .style('cursor', 'pointer')
            .on('click', function (event) {
              event.stopPropagation();
              handlePointClick(i);
            })
            .on('mouseenter', function (event) {
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                data: {
                  [xFeature.name]: xValues[i],
                  [yFeature.name]: yValues[i],
                  'SPL (dB)': targetValues[i] ?? 0,
                },
              });
            })
            .on('mouseleave', function () {
              setTooltip(null);
            });
        }

        // X-axis labels (only for bottom row)
        if (row === gridSize - 1) {
          const labelFontSize = Math.min(10, cellSize / 10);

          // Tick labels
          xTicks.forEach(tick => {
            cellG.append('text')
              .attr('x', xScale(tick))
              .attr('y', cellSize + 14)
              .attr('text-anchor', 'middle')
              .attr('font-size', labelFontSize + 'px')
              .attr('fill', '#666')
              .text(formatTickValue(tick));
          });

          // Feature label
          const isTarget = xFeature.id === TARGET_FEATURE_ID;
          cellG.append('text')
            .attr('x', cellSize / 2)
            .attr('y', cellSize + 32)
            .attr('text-anchor', 'middle')
            .attr('font-size', (labelFontSize + 1) + 'px')
            .attr('font-weight', 'bold')
            .attr('fill', isTarget ? THEME_COLORS.warm : '#424242')
            .text(getShortLabel(xFeature.name));
        }

        // Y-axis labels (only for leftmost column)
        if (col === 0) {
          const labelFontSize = Math.min(10, cellSize / 10);

          // Tick labels
          yTicks.forEach(tick => {
            cellG.append('text')
              .attr('x', -6)
              .attr('y', yScale(tick))
              .attr('text-anchor', 'end')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', labelFontSize + 'px')
              .attr('fill', '#666')
              .text(formatTickValue(tick));
          });

          // Feature label (rotated)
          const isTarget = yFeature.id === TARGET_FEATURE_ID;
          cellG.append('text')
            .attr('transform', `translate(${-36},${cellSize / 2}) rotate(-90)`)
            .attr('text-anchor', 'middle')
            .attr('font-size', (labelFontSize + 1) + 'px')
            .attr('font-weight', 'bold')
            .attr('fill', isTarget ? THEME_COLORS.warm : '#424242')
            .text(getShortLabel(yFeature.name));
        }
      });
    });

  }, [
    selectedFeatures,
    xFeatures,
    yFeatures,
    xScales,
    yScales,
    cellSize,
    gridSize,
    sampledIndices,
    targetValues,
    colorScale,
    brushedIndices,
    highlightedIndex,
    handleBrushEnd,
    handlePointClick,
    onBrush,
  ]);

  if (selectedFeatures.length < 2) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-lg mb-2">Select at least 2 features</div>
          <div className="text-sm">Scatterplot matrix requires multiple features</div>
        </div>
      </div>
    );
  }

  // CSV data generator for scatterplot matrix
  const getMatrixCSVData = () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < dataLength; i++) {
      const row: Record<string, unknown> = { index: i + 1 };
      selectedFeatures.forEach(f => {
        row[f.name] = f.values[i];
      });
      if (targetFeature) {
        row['SPL (dB)'] = targetValues[i];
      }
      rows.push(row);
    }
    return rows;
  };

  return (
    <div className="relative">
      <div className="absolute top-1 right-1 z-10">
        <DownloadButton
          svgRef={svgRef}
          filename="scatterplot_matrix"
          csvData={getMatrixCSVData}
          formats={['png', 'svg', 'csv']}
        />
      </div>
      <svg
        ref={svgRef}
        width={Math.min(width, matrixWidth + PADDING.outer * 2)}
        height={height}
        className="bg-white rounded-lg"
        onClick={() => setHighlightedIndex(null)}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg z-10"
          style={{
            left: Math.min(tooltip.x + 10, width - 200),
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-semibold mb-1">Data Point</div>
          {Object.entries(tooltip.data).map(([key, value]) => (
            <div key={key} className="text-gray-300">
              {key}: <span className="text-white font-mono">{formatValue(value as number)}</span>
            </div>
          ))}
          <div className="text-xs text-gray-400 mt-1">Click to highlight across all plots</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME_COLORS.deepBlue }} />
            <span>Low SPL</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-white border border-gray-300" />
            <span>Mid</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME_COLORS.deepOrange }} />
            <span>High SPL</span>
          </div>
          {highlightedIndex !== null && (
            <div className="flex items-center gap-1 ml-4 text-primary font-medium">
              <div className="w-3 h-3 rounded-full border-2 border-black bg-accent" />
              <span>Point #{highlightedIndex + 1} highlighted</span>
              <button
                onClick={() => setHighlightedIndex(null)}
                className="ml-1 text-xs underline hover:text-primary-dark"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="text-gray-500">
          {sampledIndices.length < dataLength
            ? `Showing ${sampledIndices.length} of ${dataLength} points`
            : `${dataLength} points`}
        </div>
      </div>
    </div>
  );
}
