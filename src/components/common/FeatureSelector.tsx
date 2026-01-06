import { useState, useRef, useEffect, useCallback } from 'react';
import { useFeatureStore, type FeatureDefinition, TARGET_FEATURE_ID } from '../../stores/featureStore';

interface FeatureSelectorProps {
  /** Optional custom label */
  label?: string;
  /** Include target feature in selection */
  includeTarget?: boolean;
  /** Controlled mode: external selection state */
  selectedIds?: string[];
  /** Called when selection changes */
  onChange?: (featureIds: string[]) => void;
  /** Custom class for the container */
  className?: string;
}

/**
 * Badge component for feature type
 */
function TypeBadge({ type }: { type: FeatureDefinition['type'] }) {
  const colors = {
    original: 'bg-blue-100 text-blue-700',
    transformed: 'bg-purple-100 text-purple-700',
    pca: 'bg-green-100 text-green-700',
  };

  const labels = {
    original: 'Original',
    transformed: 'Transform',
    pca: 'PCA',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

/**
 * Multi-select dropdown for selecting features from the feature store
 */
export function FeatureSelector({
  label = 'Features',
  includeTarget = true,
  selectedIds,
  onChange,
  className = '',
}: FeatureSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    features,
    selectedFeatureIds: storeSelectedIds,
    setSelectedFeatureIds,
    getAllFeatures,
  } = useFeatureStore();

  // Use controlled mode if selectedIds is provided, otherwise use store
  const isControlled = selectedIds !== undefined;
  const currentSelection = isControlled ? selectedIds : storeSelectedIds;

  // Get all available features
  const allFeatures = getAllFeatures();
  const targetFeature = features[TARGET_FEATURE_ID];

  // Include target if requested
  const availableFeatures = includeTarget && targetFeature
    ? [...allFeatures, targetFeature]
    : allFeatures;

  // Sort features: original first, then transformed, then PCA
  const sortedFeatures = [...availableFeatures].sort((a, b) => {
    const typeOrder = { original: 0, transformed: 1, pca: 2 };
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.name.localeCompare(b.name);
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to update selection (handles controlled vs uncontrolled)
  const updateSelection = useCallback((newSelection: string[]) => {
    if (!isControlled) {
      setSelectedFeatureIds(newSelection);
    }
    onChange?.(newSelection);
  }, [isControlled, setSelectedFeatureIds, onChange]);

  // Toggle feature selection
  const toggleFeature = useCallback((featureId: string) => {
    const newSelection = currentSelection.includes(featureId)
      ? currentSelection.filter(id => id !== featureId)
      : [...currentSelection, featureId];
    updateSelection(newSelection);
  }, [currentSelection, updateSelection]);

  // Select all features
  const selectAll = useCallback(() => {
    const allIds = sortedFeatures.map(f => f.id);
    updateSelection(allIds);
  }, [sortedFeatures, updateSelection]);

  // Clear all selections
  const clearAll = useCallback(() => {
    updateSelection([]);
  }, [updateSelection]);

  // Select only original features
  const selectOriginalOnly = useCallback(() => {
    const originalIds = sortedFeatures
      .filter(f => f.type === 'original')
      .map(f => f.id);
    updateSelection(originalIds);
  }, [sortedFeatures, updateSelection]);

  const selectedCount = currentSelection.filter(id =>
    sortedFeatures.some(f => f.id === id)
  ).length;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-accent transition-colors text-base"
      >
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="bg-accent text-white text-sm px-2 py-0.5 rounded-full font-medium">
          {selectedCount}/{sortedFeatures.length}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Quick actions */}
          <div className="flex items-center gap-2 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <button
              onClick={selectAll}
              className="text-sm text-accent hover:text-primary font-medium"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={clearAll}
              className="text-sm text-accent hover:text-primary font-medium"
            >
              Clear
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={selectOriginalOnly}
              className="text-sm text-accent hover:text-primary font-medium"
            >
              Original Only
            </button>
          </div>

          {/* Feature list */}
          <div className="max-h-72 overflow-y-auto p-1">
            {sortedFeatures.length === 0 ? (
              <div className="px-3 py-4 text-gray-500 text-center">
                No features available
              </div>
            ) : (
              sortedFeatures.map((feature) => {
                const isSelected = currentSelection.includes(feature.id);
                const isTarget = feature.id === TARGET_FEATURE_ID;

                return (
                  <label
                    key={feature.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-accent-light'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFeature(feature.id)}
                      className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${
                          isTarget ? 'font-semibold text-warm' : 'text-gray-700'
                        }`}>
                          {feature.name}
                        </span>
                        {isTarget && (
                          <span className="text-xs bg-warm text-white px-1.5 py-0.5 rounded">
                            Target
                          </span>
                        )}
                      </div>
                    </div>
                    <TypeBadge type={feature.type} />
                  </label>
                );
              })
            )}
          </div>

          {/* Footer with count */}
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg text-sm text-gray-600">
            {selectedCount} of {sortedFeatures.length} features selected
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact feature selector showing just selected features as chips
 */
export function FeatureSelectorChips({
  label = 'Selected Features',
  onChange,
  className = '',
}: Omit<FeatureSelectorProps, 'includeTarget'>) {
  const { selectedFeatureIds, getSelectedFeatures, setSelectedFeatureIds } = useFeatureStore();
  const selectedFeatures = getSelectedFeatures();

  const handleRemove = useCallback((featureId: string) => {
    const newSelection = selectedFeatureIds.filter(id => id !== featureId);
    setSelectedFeatureIds(newSelection);
    onChange?.(newSelection);
  }, [selectedFeatureIds, setSelectedFeatureIds, onChange]);

  if (selectedFeatures.length === 0) {
    return (
      <div className={`text-gray-500 text-sm ${className}`}>
        No features selected
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {label && <span className="text-sm text-gray-600 font-medium mr-2">{label}:</span>}
      {selectedFeatures.map((feature) => (
        <span
          key={feature.id}
          className="inline-flex items-center gap-1 px-2 py-1 bg-accent-light text-primary text-sm rounded-full"
        >
          {feature.name}
          <button
            onClick={() => handleRemove(feature.id)}
            className="hover:bg-accent/20 rounded-full p-0.5 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}
