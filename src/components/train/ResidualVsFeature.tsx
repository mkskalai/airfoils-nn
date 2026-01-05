import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { PredictionPoint } from '../../stores/modelStore';
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

export function ResidualVsFeature({
  trainPredictions,
  valPredictions,
  activeTab,
}: ResidualVsFeatureProps) {
  const showTrain = activeTab === 'train' || activeTab === 'both';
  const showVal = activeTab === 'validation' || activeTab === 'both';

  // Prepare data for each feature
  const featureData = useMemo(() => {
    const result: Record<FeatureKey, { train: { x: number; residual: number }[]; val: { x: number; residual: number }[] }> = {} as any;

    for (const feature of FEATURE_NAMES) {
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
  }, [trainPredictions, valPredictions]);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Residual vs Feature</h4>
        <div className="text-xs text-gray-400">
          Y-axis: Residual (dB)
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {FEATURE_NAMES.map((feature) => (
          <SingleFeaturePlot
            key={feature}
            feature={feature}
            trainData={featureData[feature].train}
            valData={featureData[feature].val}
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
