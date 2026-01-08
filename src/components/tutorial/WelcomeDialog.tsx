import { useTutorialStore } from '../../stores/tutorialStore';

/**
 * Welcome dialog shown to new users
 */
export function WelcomeDialog() {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const showWelcome = useTutorialStore(state => state.showWelcome);
  const hideWelcomeDialog = useTutorialStore(state => state.hideWelcomeDialog);
  const startTutorial = useTutorialStore(state => state.startTutorial);
  const skipTutorial = useTutorialStore(state => state.skipTutorial);

  if (!showWelcome) return null;

  const handleStartTutorial = () => {
    hideWelcomeDialog();
    startTutorial();
  };

  const handleSkip = () => {
    hideWelcomeDialog();
    skipTutorial();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Airfoil Noise Prediction</h2>
          <p className="text-white/80">Learn machine learning by solving a real engineering problem</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6 text-center">
            This app teaches you the fundamentals of neural networks through an interactive, hands-on tutorial.
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
              <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-sm">1</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">Explore the Data</h4>
                <p className="text-sm text-gray-600">Understand feature distributions and correlations</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
              <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-sm">2</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">Train Neural Networks</h4>
                <p className="text-sm text-gray-600">See why feature engineering matters more than model complexity</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
              <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-sm">3</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">Make Predictions</h4>
                <p className="text-sm text-gray-600">Use your trained model to predict airfoil noise</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center mb-6">
            The tutorial takes about 5-10 minutes and includes links to Wikipedia for all ML concepts.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 py-3 text-gray-600 font-medium rounded-lg border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Skip Tutorial
            </button>
            <button
              onClick={handleStartTutorial}
              className="flex-1 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
            >
              Start Tutorial
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
