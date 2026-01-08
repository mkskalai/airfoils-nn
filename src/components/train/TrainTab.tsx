import { useMemo } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { useDataStore } from '../../stores/dataStore';
import { useTraining } from '../../hooks/useTraining';
import { ConfigPanel } from './ConfigPanel';
import { NetworkPreview } from './NetworkPreview';
import { NetworkViz } from './NetworkViz';
import { LossChart } from './LossChart';
import { PredictionScatterplot } from './PredictionScatterplot';
import { ErrorAnalysis } from './ErrorAnalysis';
import { THEME_COLORS } from '../../utils/colors';

export function TrainTab() {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const config = useModelStore(state => state.config);
  const trainingStatus = useModelStore(state => state.trainingStatus);
  const trainingError = useModelStore(state => state.trainingError);
  const currentEpoch = useModelStore(state => state.currentEpoch);
  const trainingHistory = useModelStore(state => state.trainingHistory);
  const bestValLoss = useModelStore(state => state.bestValLoss);
  const trainPredictions = useModelStore(state => state.trainPredictions);
  const valPredictions = useModelStore(state => state.valPredictions);
  const networkWeights = useModelStore(state => state.networkWeights);

  // Use individual selectors for dataStore too
  const trainData = useDataStore(state => state.trainData);
  const validationData = useDataStore(state => state.validationData);
  const { startTraining, pauseTraining, resumeTraining, stopTraining, reset } = useTraining();

  // Compute shared domain for both scatterplots so they have the same axis scale
  const sharedDomain = useMemo<[number, number] | undefined>(() => {
    const allPredictions = [...trainPredictions, ...valPredictions];
    if (allPredictions.length === 0) return undefined;

    const allValues = allPredictions.flatMap(d => [d.groundTruth, d.predicted]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const padding = (maxVal - minVal) * 0.05 || 0.1;
    return [minVal - padding, maxVal + padding];
  }, [trainPredictions, valPredictions]);

  const statusConfig = {
    idle: { color: 'bg-gray-100 text-gray-600', icon: '○', label: 'Ready' },
    training: { color: 'bg-accent-light text-accent', icon: '●', label: 'Training' },
    paused: { color: 'bg-yellow-100 text-yellow-700', icon: '◐', label: 'Paused' },
    complete: { color: 'bg-green-100 text-green-700', icon: '✓', label: 'Complete' },
    error: { color: 'bg-red-100 text-red-700', icon: '✕', label: 'Error' },
  };

  const handleTrain = () => {
    if (trainingStatus === 'paused') {
      resumeTraining();
    } else {
      startTraining();
    }
  };

  const handlePause = () => {
    if (trainingStatus === 'training') {
      pauseTraining();
    }
  };

  const handleStop = () => {
    stopTraining();
  };

  const handleReset = () => {
    reset();
  };

  const dataReady = trainData.length > 0 && validationData.length > 0;

  const latestLoss = trainingHistory.length > 0 ? trainingHistory[trainingHistory.length - 1] : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Configuration Panel */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <ConfigPanel
            onTrain={handleTrain}
            onPause={handlePause}
            onStop={handleStop}
            onReset={handleReset}
            dataReady={dataReady}
          />
        </div>

        {/* Right Column: Preview and Status */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Network Preview (before training) or Network Weights Viz (during/after training) */}
          {networkWeights ? <NetworkViz /> : <NetworkPreview />}

          {/* Training Status Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Training Status
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {/* Status Badge */}
              <div className="col-span-1 sm:col-span-1">
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Status</div>
                <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${statusConfig[trainingStatus].color}`}>
                  <span>{statusConfig[trainingStatus].icon}</span>
                  {statusConfig[trainingStatus].label}
                </span>
              </div>

              {/* Progress */}
              <div>
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Epoch</div>
                <div className="text-lg sm:text-xl font-semibold text-gray-800">
                  {currentEpoch} <span className="text-xs sm:text-sm text-gray-400">/ {config.epochs}</span>
                </div>
              </div>

              {/* Current Loss */}
              <div>
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Train Loss</div>
                <div className="text-lg sm:text-xl font-mono font-semibold text-gray-800">
                  {latestLoss ? latestLoss.loss.toFixed(4) : '—'}
                </div>
              </div>

              {/* Best Val Loss */}
              <div>
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Best Val Loss</div>
                <div className="text-lg sm:text-xl font-mono font-semibold text-green-600">
                  {bestValLoss !== null ? bestValLoss.toFixed(4) : '—'}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    trainingStatus === 'complete' ? 'bg-green-500' :
                    trainingStatus === 'error' ? 'bg-red-500' : 'bg-accent'
                  }`}
                  style={{ width: `${config.epochs > 0 ? (currentEpoch / config.epochs) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>{config.epochs > 0 ? ((currentEpoch / config.epochs) * 100).toFixed(0) : 0}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Error Message */}
            {trainingStatus === 'error' && trainingError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-red-800">Training Error</h4>
                    <p className="text-sm text-red-700 mt-1">{trainingError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Loss Chart Placeholder */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Training History
            </h3>

            {/* Loss chart with mini stats */}
            <div className="space-y-3 sm:space-y-4">
              {/* Mini loss display */}
              {trainingHistory.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-accent/5 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">Training Loss</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-accent">
                      {latestLoss?.loss.toFixed(6)}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 bg-warm/5 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">Validation Loss</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-warm">
                      {latestLoss?.valLoss.toFixed(6)}
                    </div>
                  </div>
                </div>
              )}

              {/* D3 Loss Chart */}
              <div className="bg-gray-50 rounded-lg p-2">
                <LossChart
                  history={trainingHistory}
                  bestValLoss={bestValLoss}
                  height={280}
                />
              </div>
            </div>
          </div>

          {/* Prediction Scatterplots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs sm:text-sm text-gray-500">
                  {trainPredictions.length > 0 ? `${trainPredictions.length} samples` : ''}
                </span>
              </div>
              <PredictionScatterplot
                data={trainPredictions}
                title="Training Set"
                color={THEME_COLORS.accent}
                height={280}
                sharedDomain={sharedDomain}
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-warm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs sm:text-sm text-gray-500">
                  {valPredictions.length > 0 ? `${valPredictions.length} samples` : ''}
                </span>
              </div>
              <PredictionScatterplot
                data={valPredictions}
                title="Validation Set"
                color={THEME_COLORS.warm}
                height={280}
                sharedDomain={sharedDomain}
              />
            </div>
          </div>

          {/* Error Analysis */}
          <ErrorAnalysis
            trainPredictions={trainPredictions}
            valPredictions={valPredictions}
          />

        </div>
      </div>
    </div>
  );
}
