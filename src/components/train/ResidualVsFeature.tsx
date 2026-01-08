import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useModelStore, type PredictionPoint } from '../../stores/modelStore';
import { ORIGINAL_FEATURE_IDS } from '../../stores/featureStore';
import { THEME_COLORS } from '../../utils/colors';
import { FEATURE_LABELS, FEATURE_NAMES } from '../../types';

interface ResidualVsFeatureProps {
  trainPredictions: PredictionPoint[];
  valPredictions: PredictionPoint[];
  activeTab: 'train' | 'validation' | 'both';
}

const MARGIN = { top: 15, right: 15, bottom: 35, left: 45 };
const PLOT_HEIGHT = 180;

type FeatureKey = (typeof FEATURE_NAMES)[number];

function SingleFeaturePlot({
  feature,
  trainData,
  valData,
  showTrain,
  showVal,
  sharedYDomain,
}: {
  feature: FeatureKey;
  trainData: { x: number; residual: number }[];
  valData: { x: number; residual: number }[];
  showTrain: boolean;
  showVal: boolean;
  sharedYDomain: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(200);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) setContainerWidth(newWidth);
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth || 200);

    return () => resizeObserver.disconnect();
  }, []);

  const width = containerWidth;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;

  // Compute X domain from visible data
  const xDomain = useMemo(() => {
    const allX: number[] = [];
    if (showTrain) allX.push(...trainData.map((d) => d.x));
    if (showVal) allX.push(...valData.map((d) => d.x));
    if (allX.length === 0) return [0, 1] as [number, number];
    const min = Math.min(...allX);
    const max = Math.max(...allX);
    const padding = (max - min) * 0.05 || 0.1;
    return [min - padding, max + padding] as [number, number];
  }, [trainData, valData, showTrain, showVal]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain(sharedYDomain).range([innerHeight, 0]).nice();

    // Grid
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(() => '')
      )
      .selectAll('line')
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '2,2');

    g.selectAll('.grid .domain').remove();

    // Zero line
    g.append('line')
      .attr('x1', 0)
      .attr('y1', yScale(0))
      .attr('x2', innerWidth)
      .attr('y2', yScale(0))
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // X axis
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(4));
    xAxis.selectAll('text').style('font-size', '9px').style('fill', '#888');
    xAxis.selectAll('line, path').style('stroke', '#ccc');

    // Y axis
    const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(4));
    yAxis.selectAll('text').style('font-size', '9px').style('fill', '#888');
    yAxis.selectAll('line, path').style('stroke', '#ccc');

    // Draw training points
    if (showTrain && trainData.length > 0) {
      g.selectAll('.train-point')
        .data(trainData)
        .enter()
        .append('circle')
        .attr('class', 'train-point')
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.residual))
        .attr('r', trainData.length > 500 ? 1.5 : trainData.length > 200 ? 2 : 2.5)
        .attr('fill', THEME_COLORS.accent)
        .attr('opacity', trainData.length > 200 ? 0.4 : 0.6);
    }

    // Draw validation points
    if (showVal && valData.length > 0) {
      g.selectAll('.val-point')
        .data(valData)
        .enter()
        .append('circle')
        .attr('class', 'val-point')
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.residual))
        .attr('r', valData.length > 500 ? 1.5 : valData.length > 200 ? 2 : 2.5)
        .attr('fill', THEME_COLORS.warm)
        .attr('opacity', valData.length > 200 ? 0.4 : 0.6);
    }
  }, [trainData, valData, showTrain, showVal, xDomain, sharedYDomain, innerWidth, innerHeight]);

  // Short label for feature
  const shortLabel = FEATURE_LABELS[feature].split(' ')[0];

  return (
    <div ref={containerRef} className="w-full">
      <div className="text-xs text-gray-600 font-medium mb-1 truncate" title={FEATURE_LABELS[feature]}>
        {shortLabel}
      </div>
      <svg ref={svgRef} width={width} height={PLOT_HEIGHT} className="bg-white rounded" />
    </div>
  );
}

/**
 * Feature selector dropdown for error analysis
 */
function ErrorFeatureSelector({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show original features (those that have values in PredictionPoint)
  const availableFeatures = ORIGINAL_FEATURE_IDS.map(id => ({
    id,
    name: FEATURE_LABELS[id as FeatureKey] || id,
  }));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFeature = (featureId: string) => {
    const isDeselecting = selectedIds.includes(featureId);
    if (isDeselecting && selectedIds.length <= 1) return; // Keep at least 1
    const newSelection = isDeselecting
      ? selectedIds.filter(id => id !== featureId)
      : [...selectedIds, featureId];
    onChange(newSelection);
  };

  const selectAll = () => {
    onChange([...ORIGINAL_FEATURE_IDS]);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        <span>{selectedIds.length}/{availableFeatures.length} features</span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 bg-gray-50 text-xs">
            <span className="text-gray-600">Select features</span>
            <button
              onClick={selectAll}
              className="text-accent hover:text-primary font-medium"
            >
              All
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {availableFeatures.map(({ id, name }) => {
              const isSelected = selectedIds.includes(id);
              const cannotDeselect = isSelected && selectedIds.length <= 1;

              return (
                <label
                  key={id}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${
                    isSelected ? 'bg-accent/10' : 'hover:bg-gray-50'
                  } ${cannotDeselect ? 'cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFeature(id)}
                    disabled={cannotDeselect}
                    className="w-3 h-3 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="truncate text-gray-700" title={name}>
                    {name.split(' ')[0]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ResidualVsFeature({
  trainPredictions,
  valPredictions,
  activeTab,
}: ResidualVsFeatureProps) {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const errorAnalysisFeatureIds = useModelStore(state => state.errorAnalysisFeatureIds);
  const setErrorAnalysisFeatureIds = useModelStore(state => state.setErrorAnalysisFeatureIds);

  const showTrain = activeTab === 'train' || activeTab === 'both';
  const showVal = activeTab === 'validation' || activeTab === 'both';

  // Filter to only show features that exist in PredictionPoint (original features)
  const selectedFeatures = useMemo(() => {
    return errorAnalysisFeatureIds.filter(id =>
      FEATURE_NAMES.includes(id as FeatureKey)
    ) as FeatureKey[];
  }, [errorAnalysisFeatureIds]);

  // Prepare data for each selected feature
  const featureData = useMemo(() => {
    const result: Record<FeatureKey, { train: { x: number; residual: number }[]; val: { x: number; residual: number }[] }> = {} as any;

    for (const feature of selectedFeatures) {
      result[feature] = {
        train: trainPredictions.map((p) => ({
          x: p[feature],
          residual: p.predicted - p.groundTruth,
        })),
        val: valPredictions.map((p) => ({
          x: p[feature],
          residual: p.predicted - p.groundTruth,
        })),
      };
    }

    return result;
  }, [trainPredictions, valPredictions, selectedFeatures]);

  // Compute shared Y domain across all features for consistency
  const sharedYDomain = useMemo(() => {
    const allResiduals: number[] = [];
    if (showTrain) {
      allResiduals.push(...trainPredictions.map((p) => p.predicted - p.groundTruth));
    }
    if (showVal) {
      allResiduals.push(...valPredictions.map((p) => p.predicted - p.groundTruth));
    }
    if (allResiduals.length === 0) return [-1, 1] as [number, number];
    const maxAbs = Math.max(Math.abs(d3.min(allResiduals) || 0), Math.abs(d3.max(allResiduals) || 0));
    return [-maxAbs * 1.1, maxAbs * 1.1] as [number, number];
  }, [trainPredictions, valPredictions, showTrain, showVal]);

  const hasData = trainPredictions.length > 0 || valPredictions.length > 0;

  if (!hasData) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p className="text-sm">Train a model to see residual analysis</p>
      </div>
    );
  }

  // Dynamic grid columns based on number of selected features
  const gridCols = selectedFeatures.length === 1 ? 'grid-cols-1' :
                   selectedFeatures.length === 2 ? 'grid-cols-2' :
                   selectedFeatures.length === 3 ? 'grid-cols-3' :
                   'grid-cols-2';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Residual vs Feature</h4>
        <div className="flex items-center gap-2">
          <ErrorFeatureSelector
            selectedIds={errorAnalysisFeatureIds}
            onChange={setErrorAnalysisFeatureIds}
          />
          <span className="text-xs text-gray-400">
            Y: Residual (dB)
          </span>
        </div>
      </div>
      <div className={`grid ${gridCols} gap-4`}>
        {selectedFeatures.map((feature) => (
          <SingleFeaturePlot
            key={feature}
            feature={feature}
            trainData={featureData[feature]?.train ?? []}
            valData={featureData[feature]?.val ?? []}
            showTrain={showTrain}
            showVal={showVal}
            sharedYDomain={sharedYDomain}
          />
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Look for patterns: random scatter around 0 is ideal. Trends or clusters indicate the model struggles with certain feature values.
      </div>
    </div>
  );
}
