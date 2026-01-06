import { useState, useEffect } from 'react';
import { TabNavigation } from './components/common/TabNavigation';
import { ExploreTab } from './components/explore/ExploreTab';
import { TrainTab } from './components/train/TrainTab';
import { PredictTab } from './components/predict/PredictTab';
import { useDataStore } from './stores/dataStore';
import type { TabId } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const { loadData, isLoading, error, setError } = useDataStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero Header */}
      <header className="bg-primary-dark text-white py-4 sm:py-6 md:py-8 px-4 sm:px-6">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light mb-1 sm:mb-2">
            Tinker With <span className="font-bold text-accent">Airfoil Noise Prediction</span> Right Here in Your Browser.
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-gray-300 font-light">
            Train a Neural Network. Explore the Data. Make Predictions.
          </p>
        </div>
      </header>

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="w-full">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-700 text-lg">Loading dataset...</p>
              <p className="text-gray-400 text-sm mt-1">1503 airfoil samples</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !isLoading && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Dataset</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setError(null);
                    loadData();
                  }}
                  className="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'explore' && <ExploreTab />}
        {activeTab === 'train' && <TrainTab />}
        {activeTab === 'predict' && <PredictTab />}
      </main>
    </div>
  );
}

export default App;
