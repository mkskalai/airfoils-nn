import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useFeatureStore, TARGET_FEATURE_ID } from '../../stores/featureStore';
import { dynamicCorrelationMatrix } from '../../utils/stats';
import { correlationColorScale, formatValue, THEME_COLORS } from '../../utils/colors';
import { DownloadButton } from '../common/DownloadButton';

interface CorrelationHeatmapProps {
  width: number;
  height?: number;
  /** If true, include target feature. Default true */
  includeTarget?: boolean;
  /** Optional explicit feature IDs to display (controlled mode) */
  featureIds?: string[];
}

const MARGIN = { top: 100, right: 70, bottom: 20, left: 140 };

/**
 * Generate short display labels for features
 */
function getShortLabel(name: string, maxLength: number = 20): string {
  // Common abbreviations
  const abbreviations: Record<string, string> = {
    'Frequency (Hz)': 'Frequency',
    'Angle of Attack (deg)': 'Angle of Attack',
    'Chord Length (m)': 'Chord Length',
    'Free-stream Velocity (m/s)': 'Velocity',
    'Suction Side Displacement Thickness (m)': 'SSDT',
    'Sound Pressure Level (dB)': 'SPL (Target)',
  };

  if (abbreviations[name]) {
    return abbreviations[name];
  }

  // Truncate long names
  if (name.length > maxLength) {
    return name.substring(0, maxLength - 3) + '...';
  }

  return name;
}

export function CorrelationHeatmap({
  width,
  height: propHeight,
  includeTarget = true,
  featureIds: controlledFeatureIds,
}: CorrelationHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
    rowName: string;
    colName: string;
  } | null>(null);

  // Get features from store
  const { selectedFeatureIds: storeSelectedIds, features, getSelectedFeatures } = useFeatureStore();

  // Use controlled mode if featureIds is provided
  const isControlled = controlledFeatureIds !== undefined;
  const selectedIds = isControlled ? controlledFeatureIds : storeSelectedIds;

  // Get selected features, optionally including target
  const selectedFeatures = useMemo(() => {
    // Get features based on selectedIds
    const selected = isControlled
      ? selectedIds.map(id => features[id]).filter(Boolean)
      : getSelectedFeatures();

    if (includeTarget) {
      const targetFeature = features[TARGET_FEATURE_ID];
      if (targetFeature && !selectedIds.includes(TARGET_FEATURE_ID)) {
        return [...selected, targetFeature];
      }
    }

    return selected;
  }, [isControlled, selectedIds, features, getSelectedFeatures, includeTarget]);

  // Calculate correlation matrix from selected features
  const { matrix, featureNames, featureIds } = useMemo(() => {
    if (selectedFeatures.length === 0) {
      return { matrix: [], featureNames: [], featureIds: [] };
    }

    const featureArrays = selectedFeatures.map(f => ({
      id: f.id,
      name: f.name,
      values: f.values,
    }));

    return dynamicCorrelationMatrix(featureArrays);
  }, [selectedFeatures]);

  // Calculate dimensions
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const numFeatures = featureNames.length;
  const cellSize = numFeatures > 0 ? Math.min(innerWidth / numFeatures, 80) : 50;
  const matrixSize = cellSize * numFeatures;
  const innerHeight = matrixSize;
  const height = propHeight ?? (innerHeight + MARGIN.top + MARGIN.bottom);

  useEffect(() => {
    if (!svgRef.current || matrix.length === 0 || cellSize <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Create cells
    featureNames.forEach((rowLabel, i) => {
      featureNames.forEach((colLabel, j) => {
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
              rowName: rowLabel,
              colName: colLabel,
            });
          })
          .on('mouseleave', function() {
            d3.select(this)
              .attr('stroke', 'none');
            setTooltip(null);
          });

        // Add text for correlation value
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
    featureNames.forEach((label, i) => {
      const featureId = featureIds[i];
      const isTarget = featureId === TARGET_FEATURE_ID;

      g.append('text')
        .attr('x', -12)
        .attr('y', i * cellSize + (cellSize - 2) / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.min(14, cellSize * 0.35) + 'px')
        .attr('fill', isTarget ? '#f57c00' : '#424242')
        .attr('font-weight', isTarget ? 'bold' : 'normal')
        .text(getShortLabel(label));
    });

    // Add column labels (top)
    featureNames.forEach((label, i) => {
      const featureId = featureIds[i];
      const isTarget = featureId === TARGET_FEATURE_ID;

      g.append('text')
        .attr('x', i * cellSize + (cellSize - 2) / 2)
        .attr('y', -12)
        .attr('text-anchor', 'start')
        .attr('transform', `rotate(-45, ${i * cellSize + (cellSize - 2) / 2}, -12)`)
        .attr('font-size', Math.min(14, cellSize * 0.35) + 'px')
        .attr('fill', isTarget ? '#f57c00' : '#424242')
        .attr('font-weight', isTarget ? 'bold' : 'normal')
        .text(getShortLabel(label));
    });

    // Add color scale legend (right side)
    const legendX = matrixSize + 25;
    const legendWidth = 20;
    const legendHeight = Math.min(matrixSize, 200);
    const legendY = (matrixSize - legendHeight) / 2;

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'corr-gradient-dynamic')
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
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#corr-gradient-dynamic)')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('rx', 2);

    // Legend axis
    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .tickValues([-1, -0.5, 0, 0.5, 1])
      .tickFormat(d => d.toString());

    const legendAxisG = g.append('g')
      .attr('transform', `translate(${legendX + legendWidth}, ${legendY})`)
      .call(legendAxis);

    legendAxisG.selectAll('text')
      .style('font-size', '13px')
      .style('fill', '#424242');

    legendAxisG.selectAll('line, path')
      .style('stroke', '#9e9e9e');

    // Legend title
    g.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', legendY - 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('fill', '#424242')
      .text('r');

  }, [matrix, featureNames, featureIds, cellSize, matrixSize]);

  if (selectedFeatures.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-lg mb-2">No features selected</div>
          <div className="text-sm">Select features to view correlations</div>
        </div>
      </div>
    );
  }

  if (selectedFeatures.length === 1) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-lg mb-2">Select at least 2 features</div>
          <div className="text-sm">Correlation requires multiple features</div>
        </div>
      </div>
    );
  }

  // CSV data generator for correlation matrix
  const getMatrixCSVData = () => ({
    matrix,
    rowLabels: featureNames,
    colLabels: featureNames,
  });

  return (
    <div className="relative flex flex-col flex-1">
      <div className="absolute top-1 right-1 z-10">
        <DownloadButton
          svgRef={svgRef}
          filename="correlation_heatmap"
          matrixData={getMatrixCSVData}
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
            className="absolute pointer-events-none bg-gray-900 text-white text-base rounded-lg px-3 py-2 shadow-lg z-10"
            style={{
              left: Math.min(tooltip.x + 10, width - 240),
              top: tooltip.y - 10,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-semibold mb-1">Pearson Correlation</div>
            <div className="text-gray-300 text-sm">
              <div>{tooltip.rowName}</div>
              <div className="text-gray-400">vs</div>
              <div>{tooltip.colName}</div>
            </div>
            <div className="mt-2 text-xl font-bold" style={{
              color: tooltip.value > 0 ? '#fb923c' : tooltip.value < 0 ? '#60a5fa' : '#fff'
            }}>
              r = {formatValue(tooltip.value, 3)}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-auto pt-3 text-base text-gray-700">
        Pearson correlation coefficients for {numFeatures} features. Blue indicates negative correlation, orange indicates positive.
      </div>
    </div>
  );
}
