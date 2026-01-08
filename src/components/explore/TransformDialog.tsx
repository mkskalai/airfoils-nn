import { useState, useMemo, useEffect } from 'react';
import { useFeatureStore, TARGET_FEATURE_ID } from '../../stores/featureStore';
import type { TransformType, TransformParams } from '../../utils/transforms';
import {
  getTransformDisplayName,
  applyTransform,
  computeStats,
  validateCustomTransform,
  getKnownInverse,
} from '../../utils/transforms';

interface TransformDialogProps {
  onClose: () => void;
}

/**
 * Mini histogram for preview - simple bars without D3
 */
function MiniHistogram({
  values,
  bins = 20,
  height = 80,
  color = '#03a9f4',
}: {
  values: number[];
  bins?: number;
  height?: number;
  color?: string;
}) {
  const histogram = useMemo(() => {
    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binWidth = range / bins;

    const counts = new Array(bins).fill(0);
    values.forEach((v) => {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      counts[idx]++;
    });

    const maxCount = Math.max(...counts);
    return counts.map((count) => (maxCount > 0 ? count / maxCount : 0));
  }, [values, bins]);

  if (histogram.length === 0) {
    return <div className="h-20 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }

  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {histogram.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all"
          style={{
            height: `${Math.max(h * 100, 2)}%`,
            backgroundColor: color,
            opacity: 0.7 + h * 0.3,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Transform Dialog
 * Allows users to create transformed features with preview
 */
export function TransformDialog({ onClose }: TransformDialogProps) {
  const { getOriginalFeatures, getTransformedFeatures, addTransformedFeature, getFeature } =
    useFeatureStore();

  // Get all potential source features (original + transformed, not PCA)
  const sourceFeatures = [...getOriginalFeatures(), ...getTransformedFeatures()];

  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [transformType, setTransformType] = useState<TransformType>('zscore');
  const [customExpression, setCustomExpression] = useState('');
  const [inverseExpression, setInverseExpression] = useState('');
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [expressionError, setExpressionError] = useState<string | null>(null);
  const [inverseError, setInverseError] = useState<string | null>(null);


  // Check if any selected feature is target or derived from target (recursive)
  const isTargetTransform = useMemo(() => {
    const checkDerivedFromTarget = (featureId: string): boolean => {
      if (featureId === TARGET_FEATURE_ID) return true;
      const feature = getFeature(featureId);
      if (!feature) return false;
      if (feature.sourceFeatureId) {
        return checkDerivedFromTarget(feature.sourceFeatureId);
      }
      return false;
    };
    return Array.from(selectedSourceIds).some(id => checkDerivedFromTarget(id));
  }, [selectedSourceIds, getFeature]);

  // Generate default name for a feature + transform
  const getDefaultName = (sourceId: string) => {
    const feature = getFeature(sourceId);
    if (!feature) return '';
    const suffix = transformType === 'custom'
      ? customExpression.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '') || 'custom'
      : transformType;
    return `${feature.name}_${suffix}`;
  };

  // Handle feature toggle
  const handleToggleFeature = (featureId: string) => {
    const newSelected = new Set(selectedSourceIds);
    if (newSelected.has(featureId)) {
      newSelected.delete(featureId);
      // Remove custom name
      const newNames = { ...customNames };
      delete newNames[featureId];
      setCustomNames(newNames);
    } else {
      newSelected.add(featureId);
    }
    setSelectedSourceIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedSourceIds(new Set(sourceFeatures.map(f => f.id)));
  };

  const handleClearAll = () => {
    setSelectedSourceIds(new Set());
    setCustomNames({});
  };

  // Auto-fill inverse when expression changes to a known one
  useEffect(() => {
    if (customExpression && transformType === 'custom') {
      const knownInverse = getKnownInverse(customExpression);
      if (knownInverse) {
        setInverseExpression(knownInverse);
        setInverseError(null);
      }
    }
  }, [customExpression, transformType]);

  // Build transform params for custom expressions
  const customParams: TransformParams | undefined = useMemo(() => {
    if (transformType !== 'custom' || !customExpression.trim()) {
      return undefined;
    }
    return {
      expression: customExpression,
      inverseExpression: inverseExpression || undefined,
    };
  }, [transformType, customExpression, inverseExpression]);


  const handleExpressionChange = (expr: string) => {
    setCustomExpression(expr);
    if (expr.trim()) {
      const validationError = validateCustomTransform(expr);
      setExpressionError(validationError);
    } else {
      setExpressionError(null);
    }
  };

  const handleInverseChange = (expr: string) => {
    setInverseExpression(expr);
    if (expr.trim()) {
      const validationError = validateCustomTransform(expr);
      setInverseError(validationError);
    } else {
      setInverseError(null);
    }
  };

  const handleCreate = () => {
    if (selectedSourceIds.size === 0) {
      setError('Please select at least one source feature');
      return;
    }

    if (transformType === 'none') {
      setError('Please select a transform type');
      return;
    }

    if (transformType === 'custom') {
      if (!customExpression.trim()) {
        setError('Please enter a custom expression');
        return;
      }
      const validationError = validateCustomTransform(customExpression);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const params = transformType === 'custom' ? customParams : undefined;
    const createdIds: string[] = [];

    // Create transformed feature for each selected source
    for (const sourceId of selectedSourceIds) {
      const name = customNames[sourceId] || getDefaultName(sourceId);
      const result = addTransformedFeature(
        sourceId,
        transformType,
        params,
        name
      );
      if (result) {
        createdIds.push(result);
      }
    }

    if (createdIds.length > 0) {
      onClose();
    } else {
      setError('Failed to create features');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-[32rem] min-w-[24rem] max-w-[90vw] max-h-[90vh] overflow-y-auto resize-x overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Add Transform</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Source Feature Multi-Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Source Features ({selectedSourceIds.size} selected)
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
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {sourceFeatures.map((feature) => (
                <label
                  key={feature.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedSourceIds.has(feature.id)}
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

          {/* Transform Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transform Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['zscore', 'minmax', 'custom'] as TransformType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTransformType(type)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    transformType === type
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getTransformDisplayName(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Transform Description */}
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            {transformType === 'zscore' && (
              <>
                <strong>Z-Score Standardization:</strong> Standardizes to mean=0, std=1.
                <br />
                <code className="text-xs bg-gray-200 px-1 rounded">x' = (x - μ) / σ</code>
              </>
            )}
            {transformType === 'minmax' && (
              <>
                <strong>Min-Max Normalization:</strong> Scales values to [0, 1] range.
                <br />
                <code className="text-xs bg-gray-200 px-1 rounded">
                  x' = (x - min) / (max - min)
                </code>
              </>
            )}
            {transformType === 'custom' && (
              <>
                <strong>Custom Expression:</strong> Write a mathematical expression.
                <br />
                <span className="text-xs">
                  Variables: <code className="bg-gray-200 px-1 rounded">x</code> (value),{' '}
                  <code className="bg-gray-200 px-1 rounded">min</code>,{' '}
                  <code className="bg-gray-200 px-1 rounded">max</code>,{' '}
                  <code className="bg-gray-200 px-1 rounded">mean</code>,{' '}
                  <code className="bg-gray-200 px-1 rounded">std</code>
                </span>
                <br />
                <span className="text-xs">
                  Functions: log, log10, sqrt, exp, abs, pow, sin, cos, floor, ceil, round
                </span>
              </>
            )}
          </div>

          {/* Custom Expression Input */}
          {transformType === 'custom' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Expression</label>
              <input
                type="text"
                value={customExpression}
                onChange={(e) => handleExpressionChange(e.target.value)}
                placeholder="e.g., log(x+1) or (x-min)/(max-min)"
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent ${
                  expressionError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {expressionError && (
                <p className="text-xs text-red-600">{expressionError}</p>
              )}
              {/* Example expressions */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['log(x+1)', 'sqrt(x)', '(x-min)/(max-min)', '(x-mean)/std', 'pow(x, 2)'].map(
                  (example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExpressionChange(example)}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-mono transition-colors"
                    >
                      {example}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Inverse Expression Input - only for target transforms */}
          {transformType === 'custom' && isTargetTransform && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Inverse Expression{' '}
                <span className="text-gray-400 font-normal">(required for target)</span>
              </label>
              <input
                type="text"
                value={inverseExpression}
                onChange={(e) => handleInverseChange(e.target.value)}
                placeholder="e.g., exp(x)-1 for log(x+1)"
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent ${
                  inverseError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {inverseError && (
                <p className="text-xs text-red-600">{inverseError}</p>
              )}
              {!inverseExpression && !inverseError && (
                <p className="text-xs text-amber-600">
                  Without inverse, this transform cannot be used as network output
                </p>
              )}
            </div>
          )}

          {/* Feature Names - shown when features are selected */}
          {selectedSourceIds.size > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output Names <span className="text-gray-400 font-normal">(adjust as needed)</span>
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                {Array.from(selectedSourceIds).map((sourceId) => {
                  const feature = getFeature(sourceId);
                  const defaultName = getDefaultName(sourceId);
                  return (
                    <div key={sourceId} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-24 truncate" title={feature?.name}>
                        {feature?.name}:
                      </span>
                      <input
                        type="text"
                        value={customNames[sourceId] ?? ''}
                        onChange={(e) => setCustomNames({ ...customNames, [sourceId]: e.target.value })}
                        placeholder={defaultName}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview - shows all selected features */}
          {selectedSourceIds.size > 0 && (
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700 mb-3">
                Preview ({selectedSourceIds.size} feature{selectedSourceIds.size !== 1 ? 's' : ''})
              </div>

              <div className="space-y-4 max-h-64 overflow-y-auto">
                {Array.from(selectedSourceIds).map((sourceId) => {
                  const feature = getFeature(sourceId);
                  if (!feature) return null;

                  // Compute preview values for this feature
                  let thisPreviewValues = feature.values;
                  if (transformType !== 'none') {
                    if (transformType === 'custom') {
                      if (customExpression.trim() && !expressionError) {
                        thisPreviewValues = feature.values.map((v) =>
                          applyTransform(v, transformType, feature.stats, customParams)
                        );
                      }
                    } else {
                      thisPreviewValues = feature.values.map((v) =>
                        applyTransform(v, transformType, feature.stats, customParams)
                      );
                    }
                  }
                  const thisPreviewStats = computeStats(thisPreviewValues);

                  return (
                    <div key={sourceId} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600 truncate" title={feature.name}>
                          {feature.name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          [{thisPreviewStats.min.toFixed(2)}, {thisPreviewStats.max.toFixed(2)}]
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Original distribution */}
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Original</div>
                          <MiniHistogram values={feature.values} color="#0d47a1" height={50} bins={15} />
                        </div>
                        {/* Transformed distribution */}
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Transformed</div>
                          <MiniHistogram values={thisPreviewValues} color="#03a9f4" height={50} bins={15} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>
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
          <button
            onClick={handleCreate}
            disabled={selectedSourceIds.size === 0 || transformType === 'none' || (transformType === 'custom' && (!customExpression.trim() || !!expressionError))}
            className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create {selectedSourceIds.size} Feature{selectedSourceIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
