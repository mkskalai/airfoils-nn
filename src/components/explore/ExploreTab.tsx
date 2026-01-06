import { useState, useCallback, useRef, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { FEATURE_LABELS, type DataPoint } from '../../types';
import { DATA_KEYS } from '../../utils/data';
import { Scatterplot } from './Scatterplot';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { DistributionChart } from './DistributionChart';
import { FeatureEngineering } from './FeatureEngineering';

type FeatureKey = keyof DataPoint;

export function ExploreTab() {
  const { rawData, stats, isLoading, error } = useDataStore();

  // Scatterplot feature selection
  const [xFeature, setXFeature] = useState<FeatureKey>('frequency');
  const [yFeature, setYFeature] = useState<FeatureKey>('soundPressureLevel');

  // Linked brushing state
  const [brushedIndices, setBrushedIndices] = useState<Set<number>>(new Set());

  // KDE toggle
  const [showKDE, setShowKDE] = useState(true);

  // Container refs for measuring widths
  const scatterContainerRef = useRef<HTMLDivElement>(null);
  const corrContainerRef = useRef<HTMLDivElement>(null);
  const distContainerRef = useRef<HTMLDivElement>(null);

  // Container widths - start with reasonable defaults
  const [scatterWidth, setScatterWidth] = useState(600);
  const [corrWidth, setCorrWidth] = useState(600);
  const [distWidth, setDistWidth] = useState(350);

  // Measure container widths on mount and resize using ResizeObserver
  useEffect(() => {
    const measureWidths = () => {
      // Get the smaller of the two container widths for consistent sizing
      const scatterAvailable = scatterContainerRef.current
        ? scatterContainerRef.current.clientWidth - 48
        : 600;
      const corrAvailable = corrContainerRef.current
        ? corrContainerRef.current.clientWidth - 48
        : 600;

      // Use the same width for both charts
      const chartWidth = Math.min(scatterAvailable, corrAvailable);
      setScatterWidth(chartWidth);
      setCorrWidth(chartWidth);

      if (distContainerRef.current) {
        // For the grid, calculate individual chart width for 3 columns
        // Account for: outer container padding (p-4 = 32px), grid gaps (gap-4 = 16px × 2),
        // and each chart's internal padding (p-3 = 24px per chart)
        const containerWidth = distContainerRef.current.clientWidth - 32;
        const cellWidth = Math.floor((containerWidth - 32) / 3);
        // Subtract chart's internal p-3 padding (24px)
        const distChartWidth = cellWidth - 24;
        setDistWidth(Math.max(distChartWidth, 200));
      }
    };

    // Use ResizeObserver for more reliable measurements
    const resizeObserver = new ResizeObserver(() => {
      measureWidths();
    });

    if (scatterContainerRef.current) resizeObserver.observe(scatterContainerRef.current);
    if (corrContainerRef.current) resizeObserver.observe(corrContainerRef.current);
    if (distContainerRef.current) resizeObserver.observe(distContainerRef.current);

    // Initial measurement after layout is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(measureWidths);
    });

    return () => resizeObserver.disconnect();
  }, []);

  // Handle brush selection from scatterplot
  const handleBrush = useCallback((indices: Set<number>) => {
    setBrushedIndices(indices);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-700 text-lg">Loading dataset...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-700 text-lg">No data available</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Data Exploration</h2>
            <p className="text-base text-gray-700">
              NASA Airfoil Self-Noise Dataset — Interactive visualizations for understanding feature relationships
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-accent">{rawData.length}</div>
            <div className="text-base text-gray-700">samples</div>
          </div>
        </div>

        {/* Selection info */}
        {brushedIndices.size > 0 && (
          <div className="mt-4 p-3 bg-accent-light rounded-lg flex items-center justify-between">
            <span className="text-primary font-medium text-base">
              {brushedIndices.size} points selected
            </span>
            <button
              onClick={() => setBrushedIndices(new Set())}
              className="text-base text-primary hover:text-primary-dark underline font-medium"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Feature Engineering Panel */}
      <FeatureEngineering />

      {/* Main visualization grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Scatterplot Section */}
        <div ref={scatterContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-semibold text-gray-800">Scatterplot</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-base text-gray-700 font-medium w-6">X:</label>
                <select
                  value={xFeature}
                  onChange={(e) => setXFeature(e.target.value as FeatureKey)}
                  className="text-base border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {DATA_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FEATURE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-base text-gray-700 font-medium w-6">Y:</label>
                <select
                  value={yFeature}
                  onChange={(e) => setYFeature(e.target.value as FeatureKey)}
                  className="text-base border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {DATA_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FEATURE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Scatterplot
            data={rawData}
            xKey={xFeature}
            yKey={yFeature}
            width={scatterWidth}
            brushedIndices={brushedIndices}
            onBrush={handleBrush}
          />
        </div>

        {/* Correlation Heatmap Section */}
        <div ref={corrContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Correlation Matrix</h3>

          <CorrelationHeatmap
            data={rawData}
            width={corrWidth}
          />
        </div>
      </div>

      {/* Distribution Charts Section - Two Rows */}
      <div ref={distContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-gray-800">Feature Distributions</h3>
          <label className="flex items-center gap-2 text-base text-gray-700">
            <input
              type="checkbox"
              checked={showKDE}
              onChange={(e) => setShowKDE(e.target.checked)}
              className="rounded border-gray-300 text-accent focus:ring-accent w-4 h-4"
            />
            <span className="font-medium">Show KDE overlay (orange line)</span>
          </label>
        </div>

        {/* Two rows of 3 charts each */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DATA_KEYS.map((key) => (
            <DistributionChart
              key={key}
              data={rawData}
              feature={key}
              stats={stats[key]}
              width={distWidth}
              showKDE={showKDE}
              brushedIndices={brushedIndices}
            />
          ))}
        </div>

        <p className="text-base text-gray-700 mt-6">
          Dashed blue line shows mean (μ). Orange line shows kernel density estimate (KDE).
          {brushedIndices.size > 0 && ' Gray bars show all data, blue bars show selected points.'}
        </p>
      </div>

      {/* Feature Statistics Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Feature Statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Feature</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Min</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Max</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Mean</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Std Dev</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Range</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats).map(([key, value]) => (
                <tr
                  key={key}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    key === 'soundPressureLevel' ? 'bg-warm-light/30' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-800">
                      {FEATURE_LABELS[key as keyof typeof FEATURE_LABELS]}
                    </span>
                    {key === 'soundPressureLevel' && (
                      <span className="ml-2 text-sm bg-warm text-white px-2 py-0.5 rounded-full">
                        Target
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">{value.min.toFixed(3)}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">{value.max.toFixed(3)}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">{value.mean.toFixed(3)}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">{value.std.toFixed(3)}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {(value.max - value.min).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
