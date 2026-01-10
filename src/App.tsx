import { useState, useEffect } from 'react';
import { TabNavigation } from './components/common/TabNavigation';
import { ExploreTab } from './components/explore/ExploreTab';
import { TrainTab } from './components/train/TrainTab';
import { PredictTab } from './components/predict/PredictTab';
import { TutorialOverlay, WelcomeDialog, TutorialButton } from './components/tutorial';
import { useDataStore } from './stores/dataStore';
import { useTutorialStore } from './stores/tutorialStore';
import type { TabId } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('explore');

  // Use individual selectors to avoid re-rendering on unrelated store changes
  const loadData = useDataStore(state => state.loadData);
  const isLoading = useDataStore(state => state.isLoading);
  const error = useDataStore(state => state.error);
  const setError = useDataStore(state => state.setError);

  const hasSeenTutorial = useTutorialStore(state => state.hasSeenTutorial);
  const showWelcomeDialog = useTutorialStore(state => state.showWelcomeDialog);
  const tutorialActive = useTutorialStore(state => state.isActive);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show welcome dialog for new users after data loads
  useEffect(() => {
    if (!isLoading && !error && !hasSeenTutorial && !tutorialActive) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        showWelcomeDialog();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, error, hasSeenTutorial, tutorialActive, showWelcomeDialog]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero Header */}
      <header className="bg-primary-dark text-white py-4 sm:py-6 md:py-8 px-4 sm:px-6">
        <div className="text-center max-w-4xl mx-auto relative">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light mb-1 sm:mb-2">
            Tinker With <span className="font-bold text-accent">Airfoil Noise Prediction</span> Right Here in Your Browser.
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-gray-300 font-light">
            Train a Neural Network. Explore the Data. Make Predictions.
          </p>
          {/* Tutorial Button */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <TutorialButton />
          </div>
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

      {/* Footer */}
      <footer className="py-4 flex justify-center gap-4">
        <a
          href="https://github.com/mkskalai/airfoils-nn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="GitHub"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
        </a>
        <a
          href="https://www.linkedin.com/in/maksym-kalaidov/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="LinkedIn"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </a>
      </footer>

      {/* Tutorial Components */}
      <WelcomeDialog />
      <TutorialOverlay onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
