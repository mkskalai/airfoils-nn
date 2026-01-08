import { useState, useRef } from 'react';
import { useFeatureStore, TARGET_FEATURE_ID } from '../../stores/featureStore';
import type { FeatureDefinition, FeatureType } from '../../stores/featureStore';
import { TransformDialog } from './TransformDialog';
import { PCADialog } from './PCADialog';

/**
 * Badge component for feature types
 */
function TypeBadge({ type }: { type: FeatureType }) {
  const styles: Record<FeatureType, string> = {
    original: 'bg-primary/10 text-primary',
    transformed: 'bg-accent/10 text-accent',
    pca: 'bg-warm/10 text-warm',
  };

  const labels: Record<FeatureType, string> = {
    original: 'original',
    transformed: 'transformed',
    pca: 'pca',
  };

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

/**
 * Single feature item in the list
 */
function FeatureItem({
  feature,
  isSelected,
  onToggleSelect,
  showCheckbox,
}: {
  feature: FeatureDefinition;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showCheckbox?: boolean;
}) {
  const isOriginal = feature.type === 'original';
  const isTarget = feature.id === TARGET_FEATURE_ID;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
        isTarget
          ? 'bg-warm/5 border-warm/20'
          : isSelected
          ? 'bg-red-50 border-red-200'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Checkbox for deletion - only for non-original features */}
        {showCheckbox && !isOriginal && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
          />
        )}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            feature.type === 'original'
              ? 'bg-primary'
              : feature.type === 'transformed'
              ? 'bg-accent'
              : 'bg-warm'
          }`}
        />
        <span className="text-sm font-medium text-gray-800 truncate" title={feature.name}>
          {feature.name}
        </span>
        <TypeBadge type={feature.type} />
        {isTarget && (
          <span className="text-xs bg-warm text-white px-2 py-0.5 rounded-full">
            Target
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {/* Stats tooltip */}
        <span
          className="text-xs text-gray-500 font-mono"
          title={`min: ${feature.stats.min.toFixed(3)}, max: ${feature.stats.max.toFixed(3)}`}
        >
          [{feature.stats.min.toFixed(1)}, {feature.stats.max.toFixed(1)}]
        </span>
      </div>
    </div>
  );
}

/**
 * Feature Engineering Panel
 * Collapsible section for managing features: view, add transforms, run PCA
 */
export function FeatureEngineering() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showTransformDialog, setShowTransformDialog] = useState(false);
  const [showPCADialog, setShowPCADialog] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const {
    features,
    deleteFeature,
    getOriginalFeatures,
    getTransformedFeatures,
    getPCAFeatures,
    initialized,
  } = useFeatureStore();

  const originalFeatures = getOriginalFeatures();
  const transformedFeatures = getTransformedFeatures();
  const pcaFeatures = getPCAFeatures();
  const targetFeature = features[TARGET_FEATURE_ID];

  const hasDeletableFeatures = transformedFeatures.length > 0 || pcaFeatures.length > 0;

  const toggleSelectForDelete = (featureId: string) => {
    const newSelected = new Set(selectedForDelete);
    if (newSelected.has(featureId)) {
      newSelected.delete(featureId);
    } else {
      newSelected.add(featureId);
    }
    setSelectedForDelete(newSelected);
  };

  const handleDeleteSelected = () => {
    selectedForDelete.forEach((id) => {
      deleteFeature(id);
    });
    setSelectedForDelete(new Set());
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  if (!initialized) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="text-gray-500 text-sm">Loading feature store...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold text-gray-800">Feature Engineering</h3>
          <span className="text-sm text-gray-500 font-medium">
            {Object.keys(features).length - 1} features
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Feature List */}
          <div className="space-y-2">
            {/* Original Features */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Input Features ({originalFeatures.length})
              </h4>
              {originalFeatures.map((feature) => (
                <FeatureItem
                  key={feature.id}
                  feature={feature}
                  showCheckbox={hasDeletableFeatures}
                />
              ))}
            </div>

            {/* Target Feature */}
            {targetFeature && (
              <div className="space-y-1 mt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Target
                </h4>
                <FeatureItem
                  feature={targetFeature}
                  showCheckbox={hasDeletableFeatures}
                />
              </div>
            )}

            {/* Transformed Features */}
            {transformedFeatures.length > 0 && (
              <div className="space-y-1 mt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Transformed ({transformedFeatures.length})
                </h4>
                {transformedFeatures.map((feature) => (
                  <FeatureItem
                    key={feature.id}
                    feature={feature}
                    showCheckbox={hasDeletableFeatures}
                    isSelected={selectedForDelete.has(feature.id)}
                    onToggleSelect={() => toggleSelectForDelete(feature.id)}
                  />
                ))}
              </div>
            )}

            {/* PCA Features */}
            {pcaFeatures.length > 0 && (
              <div className="space-y-1 mt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  PCA Components ({pcaFeatures.length})
                </h4>
                {pcaFeatures.map((feature) => (
                  <FeatureItem
                    key={feature.id}
                    feature={feature}
                    showCheckbox={hasDeletableFeatures}
                    isSelected={selectedForDelete.has(feature.id)}
                    onToggleSelect={() => toggleSelectForDelete(feature.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Delete Selected Button - shown when there are selections */}
          {selectedForDelete.size > 0 && (
            <div className="relative pt-2 border-t border-gray-100">
              <button
                ref={deleteButtonRef}
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 bg-red-50 text-red-600 font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete {selectedForDelete.size} Feature{selectedForDelete.size !== 1 ? 's' : ''}
              </button>

              {/* Confirm overlay - positioned at the same spot */}
              {showDeleteConfirm && (
                <div className="absolute inset-0 bg-red-50 rounded-lg border border-red-300 flex items-center justify-center gap-3">
                  <span className="text-sm text-red-700 font-medium">
                    Delete {selectedForDelete.size} feature{selectedForDelete.size !== 1 ? 's' : ''}?
                  </span>
                  <button
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowTransformDialog(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent/10 text-accent font-medium rounded-lg hover:bg-accent/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Transform
            </button>
            <button
              onClick={() => setShowPCADialog(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-warm/10 text-warm font-medium rounded-lg hover:bg-warm/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Run PCA
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {showTransformDialog && (
        <TransformDialog onClose={() => setShowTransformDialog(false)} />
      )}
      {showPCADialog && (
        <PCADialog onClose={() => setShowPCADialog(false)} />
      )}
    </div>
  );
}
