import { useState } from 'react';
import { useFeatureStore } from '../../stores/featureStore';
import type { PCAResult } from '../../stores/featureStore';

interface PCADialogProps {
  onClose: () => void;
}

/**
 * Variance Explained Chart
 * Shows bar chart of individual variance + cumulative line
 */
function VarianceExplainedChart({ result }: { result: PCAResult }) {
  const barWidth = 40;
  const gap = 8;
  const height = 160;
  const chartWidth = result.numComponents * (barWidth + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(chartWidth + 60, 200)} height={height + 40} className="mx-auto">
        {/* Y-axis labels */}
        <text x="25" y="20" className="text-xs fill-gray-500" textAnchor="end">
          100%
        </text>
        <text x="25" y={height / 2 + 10} className="text-xs fill-gray-500" textAnchor="end">
          50%
        </text>
        <text x="25" y={height + 5} className="text-xs fill-gray-500" textAnchor="end">
          0%
        </text>

        {/* Grid lines */}
        <line x1="30" y1="15" x2={chartWidth + 50} y2="15" className="stroke-gray-200" />
        <line
          x1="30"
          y1={height / 2 + 5}
          x2={chartWidth + 50}
          y2={height / 2 + 5}
          className="stroke-gray-200"
          strokeDasharray="4"
        />
        <line x1="30" y1={height} x2={chartWidth + 50} y2={height} className="stroke-gray-200" />

        {/* 95% threshold line */}
        <line
          x1="30"
          y1={height - 0.95 * (height - 15)}
          x2={chartWidth + 50}
          y2={height - 0.95 * (height - 15)}
          className="stroke-warm"
          strokeDasharray="4"
          strokeWidth="1.5"
        />
        <text
          x={chartWidth + 55}
          y={height - 0.95 * (height - 15) + 4}
          className="text-xs fill-warm font-medium"
        >
          95%
        </text>

        {/* Bars - individual variance */}
        {result.explainedVarianceRatio.map((ratio, i) => {
          const barHeight = ratio * (height - 15);
          const x = 40 + i * (barWidth + gap);
          const y = height - barHeight;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className="fill-accent/70"
                rx="2"
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                className="text-xs fill-gray-600 font-medium"
                textAnchor="middle"
              >
                {(ratio * 100).toFixed(1)}%
              </text>
              <text
                x={x + barWidth / 2}
                y={height + 15}
                className="text-xs fill-gray-500"
                textAnchor="middle"
              >
                PC{i + 1}
              </text>
            </g>
          );
        })}

        {/* Cumulative line */}
        <polyline
          points={result.cumulativeVarianceRatio
            .map((cum, i) => {
              const x = 40 + i * (barWidth + gap) + barWidth / 2;
              const y = height - cum * (height - 15);
              return `${x},${y}`;
            })
            .join(' ')}
          fill="none"
          className="stroke-warm"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cumulative dots */}
        {result.cumulativeVarianceRatio.map((cum, i) => {
          const x = 40 + i * (barWidth + gap) + barWidth / 2;
          const y = height - cum * (height - 15);
          return (
            <circle key={i} cx={x} cy={y} r="4" className="fill-warm" />
          );
        })}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-accent/70 rounded-sm" />
          <span>Individual variance</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-warm" />
          <span>Cumulative</span>
        </div>
      </div>
    </div>
  );
}

/**
 * PCA Dialog
 * Allows users to run PCA and save selected components as features
 */
export function PCADialog({ onClose }: PCADialogProps) {
  const {
    getOriginalFeatures,
    getTransformedFeatures,
    runPCA,
    savePCAComponents,
  } = useFeatureStore();

  // Get all available features for PCA (original + transformed)
  const availableFeatures = [...getOriginalFeatures(), ...getTransformedFeatures()];

  // State
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(
    new Set(availableFeatures.slice(0, 5).map((f) => f.id))
  );
  const [numComponents, setNumComponents] = useState(3);
  const [pcaResult, setPCAResult] = useState<PCAResult | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<Set<number>>(new Set([0, 1]));
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const maxComponents = selectedFeatureIds.size;

  const handleToggleFeature = (featureId: string) => {
    const newSelected = new Set(selectedFeatureIds);
    if (newSelected.has(featureId)) {
      newSelected.delete(featureId);
    } else {
      newSelected.add(featureId);
    }
    setSelectedFeatureIds(newSelected);

    // Adjust numComponents if needed
    if (numComponents > newSelected.size) {
      setNumComponents(Math.max(1, newSelected.size));
    }
  };

  const handleSelectAll = () => {
    setSelectedFeatureIds(new Set(availableFeatures.map((f) => f.id)));
  };

  const handleClearAll = () => {
    setSelectedFeatureIds(new Set());
  };

  const handleRunPCA = () => {
    if (selectedFeatureIds.size < 2) {
      setError('Select at least 2 features for PCA');
      return;
    }

    setIsRunning(true);
    setError(null);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const result = runPCA(
          Array.from(selectedFeatureIds),
          numComponents,
          customName || undefined
        );

        if (result) {
          setPCAResult(result);
          // Select first 2 components by default
          setSelectedComponents(new Set([0, 1].filter((i) => i < result.numComponents)));
        } else {
          setError('PCA computation failed');
        }
      } catch (err) {
        setError(`PCA error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  };

  const handleToggleComponent = (index: number) => {
    const newSelected = new Set(selectedComponents);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedComponents(newSelected);
  };

  const handleSaveComponents = () => {
    if (!pcaResult || selectedComponents.size === 0) {
      setError('Select at least one component to save');
      return;
    }

    const savedIds = savePCAComponents(
      pcaResult.id,
      Array.from(selectedComponents).sort((a, b) => a - b)
    );

    if (savedIds.length > 0) {
      onClose();
    } else {
      setError('Failed to save components');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Principal Component Analysis</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Feature Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Select Features ({selectedFeatureIds.size} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-accent hover:underline"
                >
                  Select All
                </button>
                <button onClick={handleClearAll} className="text-xs text-gray-500 hover:underline">
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {availableFeatures.map((feature) => (
                <label
                  key={feature.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedFeatureIds.has(feature.id)}
                    onChange={() => handleToggleFeature(feature.id)}
                    className="rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="truncate" title={feature.name}>
                    {feature.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Number of Components */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Components: {numComponents}
            </label>
            <input
              type="range"
              min="1"
              max={Math.max(1, maxComponents)}
              value={Math.min(numComponents, maxComponents)}
              onChange={(e) => setNumComponents(parseInt(e.target.value))}
              disabled={maxComponents < 1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>{maxComponents || 1}</span>
            </div>
          </div>

          {/* Custom Name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PCA Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Auto-generated if empty"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Run PCA Button */}
          <button
            onClick={handleRunPCA}
            disabled={selectedFeatureIds.size < 2 || isRunning}
            className="w-full py-2 bg-warm text-white font-medium rounded-lg hover:bg-warm/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Running PCA...
              </>
            ) : (
              'Run PCA'
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>
          )}

          {/* PCA Results */}
          {pcaResult && (
            <div className="border-t border-gray-200 pt-4 space-y-4">
              <h3 className="font-medium text-gray-800">Results</h3>

              {/* Variance Explained Chart */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Variance Explained</h4>
                <VarianceExplainedChart result={pcaResult} />
              </div>

              {/* Component Selection */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Save Components as Features
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: pcaResult.numComponents }).map((_, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedComponents.has(i)
                          ? 'bg-warm/10 border-warm'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedComponents.has(i)}
                        onChange={() => handleToggleComponent(i)}
                        className="rounded border-gray-300 text-warm focus:ring-warm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800">PC{i + 1}</div>
                        <div className="text-xs text-gray-500">
                          {(pcaResult.explainedVarianceRatio[i] * 100).toFixed(1)}%
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cumulative Summary */}
              {selectedComponents.size > 0 && (
                <div className="text-sm text-gray-600 bg-accent/5 p-3 rounded-lg">
                  Selected components explain{' '}
                  <strong>
                    {(
                      Array.from(selectedComponents).reduce(
                        (sum, i) => sum + pcaResult.explainedVarianceRatio[i],
                        0
                      ) * 100
                    ).toFixed(1)}
                    %
                  </strong>{' '}
                  of total variance.
                </div>
              )}

              {/* Loading Vectors Summary */}
              <details className="text-sm">
                <summary className="text-gray-600 cursor-pointer hover:text-gray-800">
                  View loading vectors
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1 px-2 text-gray-600">Feature</th>
                        {Array.from({ length: Math.min(3, pcaResult.numComponents) }).map((_, i) => (
                          <th key={i} className="text-right py-1 px-2 text-gray-600">
                            PC{i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pcaResult.sourceFeatureNames.map((name, fi) => (
                        <tr key={fi} className="border-b border-gray-100">
                          <td className="py-1 px-2 text-gray-800 truncate max-w-[120px]" title={name}>
                            {name}
                          </td>
                          {Array.from({ length: Math.min(3, pcaResult.numComponents) }).map(
                            (_, ci) => {
                              const loading = pcaResult.components[ci]?.[fi] ?? 0;
                              const absLoading = Math.abs(loading);
                              return (
                                <td
                                  key={ci}
                                  className="py-1 px-2 text-right font-mono"
                                  style={{
                                    color:
                                      loading > 0
                                        ? `rgba(230, 81, 0, ${0.3 + absLoading * 0.7})`
                                        : `rgba(26, 35, 126, ${0.3 + absLoading * 0.7})`,
                                  }}
                                >
                                  {loading.toFixed(3)}
                                </td>
                              );
                            }
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          {pcaResult && (
            <button
              onClick={handleSaveComponents}
              disabled={selectedComponents.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-warm rounded-lg hover:bg-warm/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save {selectedComponents.size} Component{selectedComponents.size !== 1 ? 's' : ''} to
              Feature Store
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
