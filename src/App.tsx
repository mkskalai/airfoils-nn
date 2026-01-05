import { useState, useEffect } from 'react';
import { TabNavigation } from './components/common/TabNavigation';
import { ExploreTab } from './components/explore/ExploreTab';
import { TrainTab } from './components/train/TrainTab';
import { PredictTab } from './components/predict/PredictTab';
import { useDataStore } from './stores/dataStore';
import type { TabId } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const { loadData, isLoading } = useDataStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero Header */}
      <header className="bg-primary-dark text-white py-8 px-6">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-light mb-2">
            Tinker With <span className="font-bold text-accent">Airfoil Noise Prediction</span> Right Here in Your Browser.
          </h1>
          <p className="text-xl text-gray-300 font-light">
            Train a Neural Network. Explore the Data. Make Predictions.
          </p>
        </div>
      </header>

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="w-full">
        {isLoading && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-700 text-lg">Loading dataset...</p>
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
