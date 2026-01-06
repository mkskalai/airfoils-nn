import { useState, useMemo, useCallback } from 'react';
import { useFeatureStore, type FeatureDefinition, TARGET_FEATURE_ID } from '../../stores/featureStore';
import { formatValue } from '../../utils/colors';

type SortKey = 'name' | 'type' | 'min' | 'max' | 'mean' | 'std' | 'range';
type SortDirection = 'asc' | 'desc';

interface FeatureStatsTableProps {
  /** Include target feature in the table */
  includeTarget?: boolean;
  /** Show only selected features */
  selectedOnly?: boolean;
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
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

/**
 * Sort indicator component
 */
function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) {
    return (
      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  return direction === 'asc' ? (
    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * Sortable header cell component (defined outside FeatureStatsTable)
 */
function SortableHeader({
  label,
  sortKeyValue,
  sortKey,
  sortDirection,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKeyValue: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className="py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={() => onSort(sortKeyValue)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <SortIndicator active={sortKey === sortKeyValue} direction={sortDirection} />
      </div>
    </th>
  );
}

/**
 * Feature statistics table with sortable columns
 */
export function FeatureStatsTable({
  includeTarget = true,
  selectedOnly = false,
}: FeatureStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { features, getSelectedFeatures, getAllFeatures } = useFeatureStore();

  // Get features to display
  const displayFeatures = useMemo(() => {
    let featureList: FeatureDefinition[];

    if (selectedOnly) {
      featureList = getSelectedFeatures();
    } else {
      featureList = getAllFeatures();
    }

    // Include target if requested
    if (includeTarget) {
      const targetFeature = features[TARGET_FEATURE_ID];
      if (targetFeature && !featureList.some(f => f.id === TARGET_FEATURE_ID)) {
        featureList = [...featureList, targetFeature];
      }
    }

    return featureList;
  }, [selectedOnly, includeTarget, getSelectedFeatures, getAllFeatures, features]);

  // Sort features
  const sortedFeatures = useMemo(() => {
    const typeOrder: Record<FeatureDefinition['type'], number> = { original: 0, transformed: 1, pca: 2 };

    const sorted = [...displayFeatures].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = typeOrder[a.type] - typeOrder[b.type];
          break;
        case 'min':
          comparison = a.stats.min - b.stats.min;
          break;
        case 'max':
          comparison = a.stats.max - b.stats.max;
          break;
        case 'mean':
          comparison = a.stats.mean - b.stats.mean;
          break;
        case 'std':
          comparison = a.stats.std - b.stats.std;
          break;
        case 'range':
          comparison = (a.stats.max - a.stats.min) - (b.stats.max - b.stats.min);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [displayFeatures, sortKey, sortDirection]);

  // Handle header click for sorting
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }, [sortKey]);

  if (displayFeatures.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Feature Statistics</h3>
        <div className="text-gray-500 text-center py-8">
          No features to display. {selectedOnly ? 'Select features to see statistics.' : ''}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800">Feature Statistics</h3>
        <span className="text-sm text-gray-500">
          {sortedFeatures.length} feature{sortedFeatures.length !== 1 ? 's' : ''}
          {selectedOnly && ' selected'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <SortableHeader
                label="Feature"
                sortKeyValue="name"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                align="left"
              />
              <SortableHeader
                label="Type"
                sortKeyValue="type"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                align="left"
              />
              <SortableHeader
                label="Min"
                sortKeyValue="min"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Max"
                sortKeyValue="max"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Mean"
                sortKeyValue="mean"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Std"
                sortKeyValue="std"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Range"
                sortKeyValue="range"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sortedFeatures.map((feature) => {
              const isTarget = feature.id === TARGET_FEATURE_ID;
              const range = feature.stats.max - feature.stats.min;

              return (
                <tr
                  key={feature.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    isTarget ? 'bg-warm-light/30' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isTarget ? 'text-warm' : 'text-gray-800'}`}>
                        {feature.name}
                      </span>
                      {isTarget && (
                        <span className="text-xs bg-warm text-white px-2 py-0.5 rounded-full">
                          Target
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <TypeBadge type={feature.type} />
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {formatValue(feature.stats.min, 3)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {formatValue(feature.stats.max, 3)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {formatValue(feature.stats.mean, 3)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {formatValue(feature.stats.std, 3)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {formatValue(range, 3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100"></div>
          <span>Original</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-100"></div>
          <span>Transformed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-100"></div>
          <span>PCA</span>
        </div>
      </div>
    </div>
  );
}
