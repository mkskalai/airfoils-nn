import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { useFeatureStore } from '../../stores/featureStore';
import { useTutorialStore } from '../../stores/tutorialStore';
import { type DataPoint } from '../../types';
import { ScatterplotMatrix } from './ScatterplotMatrix';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { DistributionChart } from './DistributionChart';
import { FeatureEngineering } from './FeatureEngineering';
import { PCAVisualization } from './PCAVisualization';
import { FeatureSelector } from '../common/FeatureSelector';
import { FeatureStatsTable } from './FeatureStatsTable';

export function ExploreTab() {
  const { rawData, stats, isLoading, error } = useDataStore();

  // Use selective subscriptions for feature store (persisted across tab switches)
  const features = useFeatureStore(state => state.features);
  const scatterFeatureIds = useFeatureStore(state => state.exploreScatterFeatureIds);
  const setScatterFeatureIds = useFeatureStore(state => state.setExploreScatterFeatureIds);
  const corrFeatureIds = useFeatureStore(state => state.exploreCorrFeatureIds);
  const setCorrFeatureIds = useFeatureStore(state => state.setExploreCorrFeatureIds);
  const distFeatureIds = useFeatureStore(state => state.exploreDistFeatureIds);
  const setDistFeatureIds = useFeatureStore(state => state.setExploreDistFeatureIds);
  const showKDE = useFeatureStore(state => state.exploreShowKDE);
  const setShowKDE = useFeatureStore(state => state.setExploreShowKDE);

  // Tutorial-controlled distribution features
  const tutorialIsActive = useTutorialStore(state => state.isActive);
  const tutorialDistFeatureIds = useTutorialStore(state => state.distributionFeatureIds);

  // Linked brushing state (local - not persisted)
  const [brushedIndices, setBrushedIndices] = useState<Set<number>>(new Set());

  // Effective feature IDs (filter out any that no longer exist)
  const effectiveCorrFeatureIds = useMemo(() =>
    corrFeatureIds.filter(id => features[id]),
    [corrFeatureIds, features]
  );

  // Use tutorial-controlled features if available, otherwise use user selection
  const effectiveDistFeatureIds = useMemo(() => {
    const sourceIds = (tutorialIsActive && tutorialDistFeatureIds)
      ? tutorialDistFeatureIds
      : distFeatureIds;
    return sourceIds.filter(id => features[id]);
  }, [tutorialIsActive, tutorialDistFeatureIds, distFeatureIds, features]);

  // Container refs for measuring widths
  const scatterContainerRef = useRef<HTMLDivElement>(null);
  const corrContainerRef = useRef<HTMLDivElement>(null);
  const distContainerRef = useRef<HTMLDivElement>(null);

  // Container widths - start with reasonable defaults
  const [scatterWidth, setScatterWidth] = useState(600);
  const [corrWidth, setCorrWidth] = useState(600);
  const [distWidth, setDistWidth] = useState(350);

  // Get selected features for distribution charts based on local state
  const selectedFeaturesForDist = useMemo(() => {
    return effectiveDistFeatureIds
      .map(id => features[id])
      .filter(Boolean);
  }, [effectiveDistFeatureIds, features]);

  // Calculate dynamic grid columns based on number of features
  const gridColumns = useMemo(() => {
    const count = selectedFeaturesForDist.length;
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    if (count <= 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }, [selectedFeaturesForDist.length]);

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
        // For the grid, calculate individual chart width based on number of columns
        const numCols = selectedFeaturesForDist.length <= 2 ? 2 :
                       selectedFeaturesForDist.length <= 3 ? 3 :
                       selectedFeaturesForDist.length <= 4 ? 4 : 4;

        // Account for: outer container padding (p-4 = 32px), grid gaps (gap-4 = 16px per gap),
        // and each chart's internal padding (p-3 = 24px per chart)
        const containerWidth = distContainerRef.current.clientWidth - 32;
        const cellWidth = Math.floor((containerWidth - (numCols - 1) * 16) / numCols);
        // Subtract chart's internal p-3 padding (24px)
        const distChartWidth = cellWidth - 24;
        setDistWidth(Math.max(distChartWidth, 180));
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
  }, [selectedFeaturesForDist.length]);

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
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
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

      {/* PCA Visualizations (shown after PCA is run) */}
      <PCAVisualization />

      {/* Main visualization grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Scatterplot Section */}
        <div ref={scatterContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-semibold text-gray-800">Scatterplot</h3>
            <FeatureSelector
              label="Features"
              includeTarget={true}
              selectedIds={scatterFeatureIds}
              onChange={setScatterFeatureIds}
              minSelected={2}
            />
          </div>

          <ScatterplotMatrix
            width={scatterWidth}
            featureIds={scatterFeatureIds}
            brushedIndices={brushedIndices}
            onBrush={handleBrush}
          />
        </div>

        {/* Correlation Heatmap Section */}
        <div ref={corrContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-gray-800">Correlation Matrix</h3>
            <FeatureSelector
              label="Features"
              includeTarget={true}
              selectedIds={effectiveCorrFeatureIds}
              onChange={setCorrFeatureIds}
            />
          </div>
          <CorrelationHeatmap
            width={corrWidth}
            includeTarget={false}
            featureIds={effectiveCorrFeatureIds}
          />
        </div>
      </div>

      {/* Distribution Charts Section */}
      <div ref={distContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-gray-800">Feature Distributions</h3>
            <FeatureSelector
              label="Features"
              includeTarget={true}
              selectedIds={effectiveDistFeatureIds}
              onChange={setDistFeatureIds}
            />
          </div>
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

        {selectedFeaturesForDist.length === 0 ? (
          <div className="text-gray-500 text-center py-12">
            <div className="text-lg mb-2">No features selected</div>
            <div className="text-sm">Use the Features selector to choose features for distribution analysis</div>
          </div>
        ) : (
          <>
            <div className={`grid ${gridColumns} gap-4`}>
              {selectedFeaturesForDist.map((feature) => {
                // Check if this is an original feature that exists in stats
                const originalKey = feature.id as keyof typeof stats;
                const featureStats = stats[originalKey];

                return (
                  <DistributionChart
                    key={feature.id}
                    data={rawData}
                    feature={feature.id as keyof DataPoint}
                    stats={featureStats || feature.stats}
                    width={distWidth}
                    showKDE={showKDE}
                    brushedIndices={brushedIndices}
                    featureDefinition={feature}
                  />
                );
              })}
            </div>

            <p className="text-base text-gray-700 mt-6">
              Dashed blue line shows mean (μ). Orange line shows kernel density estimate (KDE).
              {brushedIndices.size > 0 && ' Gray bars show all data, blue bars show selected points.'}
            </p>
          </>
        )}
      </div>

      {/* Feature Statistics Table */}
      <FeatureStatsTable
        includeTarget={true}
        selectedOnly={false}
      />
    </div>
  );
}
