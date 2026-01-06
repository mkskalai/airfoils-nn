import { useState, useEffect } from 'react';
import { useFeatureStore } from '../../stores/featureStore';
import { VarianceExplainedChart } from './VarianceExplainedChart';
import { PCALoadingsChart } from './PCALoadingsChart';
import { PCAScatterplot } from './PCAScatterplot';

type VisualizationType = 'variance' | 'loadings' | 'scatter';

/**
 * PCA Visualization Panel
 * Container component that integrates all PCA visualizations with selectors
 */
export function PCAVisualization() {
  const { getAllPCAResults, deletePCAResult } = useFeatureStore();
  const pcaResults = getAllPCAResults();

  // State
  const [selectedPCAId, setSelectedPCAId] = useState<string | null>(null);
  const [activeViz, setActiveViz] = useState<VisualizationType>('variance');
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Auto-select first PCA result when results change
  useEffect(() => {
    if (pcaResults.length > 0 && !selectedPCAId) {
      setSelectedPCAId(pcaResults[0].id);
    } else if (pcaResults.length > 0 && selectedPCAId) {
      // Verify selected ID still exists
      const exists = pcaResults.some((p) => p.id === selectedPCAId);
      if (!exists) {
        setSelectedPCAId(pcaResults[0].id);
      }
    }
  }, [pcaResults, selectedPCAId]);

  // Get selected PCA result
  const selectedPCA = pcaResults.find((p) => p.id === selectedPCAId);

  // Handle PCA selection change
  const handlePCAChange = (pcaId: string) => {
    setSelectedPCAId(pcaId);
  };

  // Handle delete with confirmation
  const handleDelete = (pcaId: string) => {
    if (deleteConfirm === pcaId) {
      deletePCAResult(pcaId);
      setDeleteConfirm(null);
      // Select another PCA if available
      const remaining = pcaResults.filter((p) => p.id !== pcaId);
      if (remaining.length > 0) {
        setSelectedPCAId(remaining[0].id);
      } else {
        setSelectedPCAId(null);
      }
    } else {
      setDeleteConfirm(pcaId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // No PCA results yet
  if (pcaResults.length === 0) {
    return null; // Don't show the section if no PCA has been run
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold text-gray-800">PCA Analysis</h3>
          <span className="text-sm text-gray-500 font-medium">
            {pcaResults.length} result{pcaResults.length !== 1 ? 's' : ''}
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

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* PCA Result Selector */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Select PCA:</label>
              <select
                value={selectedPCAId ?? ''}
                onChange={(e) => handlePCAChange(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-warm min-w-[200px]"
              >
                {pcaResults.map((pca) => (
                  <option key={pca.id} value={pca.id}>
                    {pca.name} ({pca.numComponents} components)
                  </option>
                ))}
              </select>

              {/* Delete button */}
              {selectedPCA && (
                <div className="relative">
                  <button
                    onClick={() => handleDelete(selectedPCA.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Delete PCA result"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                  {deleteConfirm === selectedPCA.id && (
                    <div className="absolute top-full left-0 mt-1 bg-red-50 border border-red-200 rounded-lg p-2 shadow-lg z-10 whitespace-nowrap">
                      <span className="text-sm text-red-700 mr-2">Delete?</span>
                      <button
                        onClick={() => handleDelete(selectedPCA.id)}
                        className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 ml-1"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info about selected PCA */}
            {selectedPCA && (
              <div className="text-sm text-gray-500">
                <span className="font-medium">{selectedPCA.sourceFeatureNames.length}</span> input features
                <span className="mx-2">•</span>
                <span className="font-medium">
                  {(selectedPCA.cumulativeVarianceRatio[selectedPCA.numComponents - 1] * 100).toFixed(1)}%
                </span> total variance
              </div>
            )}
          </div>

          {/* Visualization Type Tabs */}
          {selectedPCA && (
            <>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveViz('variance')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeViz === 'variance'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Variance
                  </div>
                </button>
                <button
                  onClick={() => setActiveViz('loadings')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeViz === 'loadings'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21l5-5 5 5M7 3l5 5 5-5"
                      />
                    </svg>
                    Loadings
                  </div>
                </button>
                <button
                  onClick={() => setActiveViz('scatter')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeViz === 'scatter'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 12h.01M12 12h.01M17 12h.01M12 7h.01M12 17h.01M7 7h.01M17 7h.01M7 17h.01M17 17h.01"
                      />
                    </svg>
                    Projection
                  </div>
                </button>
              </div>

              {/* Visualization Content */}
              <div className="bg-gray-50 rounded-lg p-4">
                {activeViz === 'variance' && (
                  <VarianceExplainedChart pcaResult={selectedPCA} height={300} />
                )}
                {activeViz === 'loadings' && (
                  <PCALoadingsChart pcaResult={selectedPCA} height={380} />
                )}
                {activeViz === 'scatter' && (
                  <PCAScatterplot pcaResult={selectedPCA} height={380} />
                )}
              </div>

              {/* Source Features Info */}
              <details className="text-sm">
                <summary className="text-gray-600 cursor-pointer hover:text-gray-800 font-medium">
                  Source features ({selectedPCA.sourceFeatureNames.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedPCA.sourceFeatureNames.map((name, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
