import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { PredictionPoint } from '../../stores/modelStore';
import { THEME_COLORS, formatValue } from '../../utils/colors';
import { ResidualVsFeature } from './ResidualVsFeature';

interface ErrorAnalysisProps {
  trainPredictions: PredictionPoint[];
  valPredictions: PredictionPoint[];
}

interface ErrorMetrics {
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
  maxError: number;
  within1dB: number;
  within3dB: number;
  meanResidual: number;
  stdResidual: number;
  skewness: number;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

function computeMetrics(predictions: PredictionPoint[]): ErrorMetrics | null {
  if (predictions.length === 0) return null;

  const residuals = predictions.map(p => p.predicted - p.groundTruth);
  const absResiduals = residuals.map(Math.abs);

  // MAE
  const mae = d3.mean(absResiduals) || 0;

  // MSE & RMSE
  const squaredErrors = residuals.map(r => r * r);
  const mse = d3.mean(squaredErrors) || 0;
  const rmse = Math.sqrt(mse);

  // R²
  const meanGT = d3.mean(predictions, p => p.groundTruth) || 0;
  const ssTotal = d3.sum(predictions, p => Math.pow(p.groundTruth - meanGT, 2));
  const ssRes = d3.sum(squaredErrors);
  const r2 = ssTotal > 0 ? 1 - ssRes / ssTotal : 0;

  // Max absolute error
  const maxError = d3.max(absResiduals) || 0;

  // Percentage within thresholds
  const within1dB = (residuals.filter(r => Math.abs(r) <= 1).length / predictions.length) * 100;
  const within3dB = (residuals.filter(r => Math.abs(r) <= 3).length / predictions.length) * 100;

  // Residual statistics
  const meanResidual = d3.mean(residuals) || 0;
  const stdResidual = d3.deviation(residuals) || 0;

  // Skewness
  const m3 = d3.mean(residuals.map(r => Math.pow(r - meanResidual, 3))) || 0;
  const skewness = stdResidual > 0 ? (m3 / Math.pow(stdResidual, 3)) : 0;

  return {
    mae,
    mse,
    rmse,
    r2,
    maxError,
    within1dB,
    within3dB,
    meanResidual,
    stdResidual,
    skewness,
  };
}

function MetricsCard({
  label,
  value,
  unit = '',
  color = 'text-gray-800',
  highlight = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-gray-100' : 'bg-gray-50'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${color}`}>
        {typeof value === 'number' ? formatValue(value, 3) : value}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ResidualHistogram({
  trainResiduals,
  valResiduals,
  height = 200,
}: {
  trainResiduals: number[];
  valResiduals: number[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);

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
    setContainerWidth(container.clientWidth || 400);

    return () => resizeObserver.disconnect();
  }, []);

  const width = containerWidth;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!svgRef.current) return;

    const allResiduals = [...trainResiduals, ...valResiduals];
    if (allResiduals.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Compute domain symmetrically around 0
    const maxAbs = Math.max(Math.abs(d3.min(allResiduals) || 0), Math.abs(d3.max(allResiduals) || 0));
    const domain: [number, number] = [-maxAbs * 1.1, maxAbs * 1.1];

    // Create bins
    const numBins = 30;
    const binGenerator = d3.bin<number, number>()
      .domain(domain)
      .thresholds(numBins);

    const trainBins = binGenerator(trainResiduals);
    const valBins = binGenerator(valResiduals);

    // Scales
    const xScale = d3.scaleLinear().domain(domain).range([0, innerWidth]);
    const maxCount = Math.max(
      d3.max(trainBins, b => b.length) || 0,
      d3.max(valBins, b => b.length) || 0
    );
    const yScale = d3.scaleLinear().domain([0, maxCount * 1.1]).range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(() => ''))
      .selectAll('line')
      .style('stroke', '#e5e5e5')
      .style('stroke-dasharray', '3,3');

    g.selectAll('.grid .domain').remove();

    // X axis
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(8));

    xAxis.selectAll('text').style('font-size', '10px').style('fill', '#666');
    xAxis.selectAll('line, path').style('stroke', '#ccc');

    // X axis label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#666')
      .text('Residual (Predicted - GT) [dB]');

    // Y axis
    const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(5));
    yAxis.selectAll('text').style('font-size', '10px').style('fill', '#666');
    yAxis.selectAll('line, path').style('stroke', '#ccc');

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#666')
      .text('Count');

    // Zero reference line
    g.append('line')
      .attr('x1', xScale(0))
      .attr('y1', 0)
      .attr('x2', xScale(0))
      .attr('y2', innerHeight)
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    const barWidth = (innerWidth / numBins) * 0.35;

    // Draw training bars
    g.selectAll('.train-bar')
      .data(trainBins)
      .enter()
      .append('rect')
      .attr('class', 'train-bar')
      .attr('x', d => xScale(d.x0!) - barWidth)
      .attr('y', d => yScale(d.length))
      .attr('width', barWidth)
      .attr('height', d => innerHeight - yScale(d.length))
      .attr('fill', THEME_COLORS.accent)
      .attr('opacity', 0.7);

    // Draw validation bars
    g.selectAll('.val-bar')
      .data(valBins)
      .enter()
      .append('rect')
      .attr('class', 'val-bar')
      .attr('x', d => xScale(d.x0!))
      .attr('y', d => yScale(d.length))
      .attr('width', barWidth)
      .attr('height', d => innerHeight - yScale(d.length))
      .attr('fill', THEME_COLORS.warm)
      .attr('opacity', 0.7);

  }, [trainResiduals, valResiduals, innerWidth, innerHeight]);

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} width={width} height={height} className="bg-white rounded-lg" />
    </div>
  );
}

export function ErrorAnalysis({ trainPredictions, valPredictions }: ErrorAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'train' | 'validation' | 'both'>('both');

  const trainMetrics = useMemo(() => computeMetrics(trainPredictions), [trainPredictions]);
  const valMetrics = useMemo(() => computeMetrics(valPredictions), [valPredictions]);

  const trainResiduals = useMemo(
    () => trainPredictions.map(p => p.predicted - p.groundTruth),
    [trainPredictions]
  );
  const valResiduals = useMemo(
    () => valPredictions.map(p => p.predicted - p.groundTruth),
    [valPredictions]
  );

  const hasData = trainPredictions.length > 0 || valPredictions.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Error Analysis
        </h3>
        <div className="flex items-center justify-center h-40 text-gray-400">
          <div className="text-center">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Train a model to see error analysis</p>
          </div>
        </div>
      </div>
    );
  }

  const displayMetrics = activeTab === 'train' ? trainMetrics :
                         activeTab === 'validation' ? valMetrics : valMetrics;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Error Analysis
        </h3>

        {/* Tab selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'both'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setActiveTab('train')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'train'
                ? 'bg-white text-accent shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Train
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'validation'
                ? 'bg-white text-warm shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Validation
          </button>
        </div>
      </div>

      {/* Residual Histogram */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Residual Distribution</h4>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME_COLORS.accent, opacity: 0.7 }} />
              <span className="text-gray-500">Train ({trainPredictions.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME_COLORS.warm, opacity: 0.7 }} />
              <span className="text-gray-500">Validation ({valPredictions.length})</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <ResidualHistogram
            trainResiduals={activeTab === 'validation' ? [] : trainResiduals}
            valResiduals={activeTab === 'train' ? [] : valResiduals}
            height={180}
          />
        </div>
      </div>

      {/* Residual vs Feature Plots */}
      <div className="mb-6 bg-gray-50 rounded-lg p-3">
        <ResidualVsFeature
          trainPredictions={trainPredictions}
          valPredictions={valPredictions}
          activeTab={activeTab}
        />
      </div>

      {/* Error Metrics Grid */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700">
          Error Metrics {activeTab !== 'both' && `(${activeTab === 'train' ? 'Training' : 'Validation'})`}
        </h4>

        {activeTab === 'both' ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Training column */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-accent mb-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.accent }} />
                Training Set
              </div>
              {trainMetrics && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricsCard label="R²" value={trainMetrics.r2} color="text-accent" highlight />
                    <MetricsCard label="RMSE" value={trainMetrics.rmse} unit="dB" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricsCard label="MAE" value={trainMetrics.mae} unit="dB" />
                    <MetricsCard label="Max Error" value={trainMetrics.maxError} unit="dB" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricsCard label="Within ±1 dB" value={`${trainMetrics.within1dB.toFixed(1)}%`} />
                    <MetricsCard label="Within ±3 dB" value={`${trainMetrics.within3dB.toFixed(1)}%`} />
                  </div>
                </>
              )}
            </div>

            {/* Validation column */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-warm mb-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.warm }} />
                Validation Set
              </div>
              {valMetrics && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricsCard label="R²" value={valMetrics.r2} color="text-warm" highlight />
                    <MetricsCard label="RMSE" value={valMetrics.rmse} unit="dB" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricsCard label="MAE" value={valMetrics.mae} unit="dB" />
                    <MetricsCard label="Max Error" value={valMetrics.maxError} unit="dB" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricsCard label="Within ±1 dB" value={`${valMetrics.within1dB.toFixed(1)}%`} />
                    <MetricsCard label="Within ±3 dB" value={`${valMetrics.within3dB.toFixed(1)}%`} />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : displayMetrics && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <MetricsCard
                label="R²"
                value={displayMetrics.r2}
                color={activeTab === 'train' ? 'text-accent' : 'text-warm'}
                highlight
              />
              <MetricsCard label="RMSE" value={displayMetrics.rmse} unit="dB" />
              <MetricsCard label="MAE" value={displayMetrics.mae} unit="dB" />
              <MetricsCard label="MSE" value={displayMetrics.mse} unit="dB²" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MetricsCard label="Max Error" value={displayMetrics.maxError} unit="dB" />
              <MetricsCard label="Within ±1 dB" value={`${displayMetrics.within1dB.toFixed(1)}%`} />
              <MetricsCard label="Within ±3 dB" value={`${displayMetrics.within3dB.toFixed(1)}%`} />
              <MetricsCard label="Mean Residual" value={displayMetrics.meanResidual} unit="dB" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MetricsCard label="Std Residual" value={displayMetrics.stdResidual} unit="dB" />
              <MetricsCard label="Skewness" value={displayMetrics.skewness} />
              <div className="col-span-2" />
            </div>
          </>
        )}
      </div>

      {/* Interpretation hints */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h5 className="text-xs font-medium text-gray-600 mb-2">Interpretation</h5>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>
            <span className="font-medium">R² close to 1:</span> Model explains most variance
          </li>
          <li>
            <span className="font-medium">Histogram centered at 0:</span> Unbiased predictions
          </li>
          <li>
            <span className="font-medium">Skewness ≈ 0:</span> Symmetric error distribution
          </li>
          <li>
            <span className="font-medium">Val metrics ≈ Train:</span> Good generalization (no overfitting)
          </li>
        </ul>
      </div>
    </div>
  );
}
