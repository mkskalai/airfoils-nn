import { useModelStore } from '../../stores/modelStore';
import { useDataStore } from '../../stores/dataStore';
import { useTraining } from '../../hooks/useTraining';
import { ConfigPanel } from './ConfigPanel';
import { NetworkPreview } from './NetworkPreview';
import { LossChart } from './LossChart';

export function TrainTab() {
  const { config, trainingStatus, currentEpoch, trainingHistory, bestValLoss } = useModelStore();
  const { trainData, validationData } = useDataStore();
  const { startTraining, pauseTraining, resumeTraining, stopTraining, reset } = useTraining();

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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <ConfigPanel
            onTrain={handleTrain}
            onPause={handlePause}
            onStop={handleStop}
            onReset={handleReset}
            dataReady={dataReady}
          />
        </div>

        {/* Right Column: Preview and Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Network Preview */}
          <NetworkPreview />

          {/* Training Status Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Training Status
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Status Badge */}
              <div className="col-span-2 md:col-span-1">
                <div className="text-sm text-gray-500 mb-1">Status</div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig[trainingStatus].color}`}>
                  <span>{statusConfig[trainingStatus].icon}</span>
                  {statusConfig[trainingStatus].label}
                </span>
              </div>

              {/* Progress */}
              <div>
                <div className="text-sm text-gray-500 mb-1">Epoch</div>
                <div className="text-xl font-semibold text-gray-800">
                  {currentEpoch} <span className="text-sm text-gray-400">/ {config.epochs}</span>
                </div>
              </div>

              {/* Current Loss */}
              <div>
                <div className="text-sm text-gray-500 mb-1">Train Loss</div>
                <div className="text-xl font-mono font-semibold text-gray-800">
                  {latestLoss ? latestLoss.loss.toFixed(4) : '—'}
                </div>
              </div>

              {/* Best Val Loss */}
              <div>
                <div className="text-sm text-gray-500 mb-1">Best Val Loss</div>
                <div className="text-xl font-mono font-semibold text-green-600">
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
          </div>

          {/* Loss Chart Placeholder */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Training History
            </h3>

            {/* Loss chart with mini stats */}
            <div className="space-y-4">
              {/* Mini loss display */}
              {trainingHistory.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-accent/5 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Training Loss</div>
                    <div className="text-2xl font-mono font-bold text-accent">
                      {latestLoss?.loss.toFixed(6)}
                    </div>
                  </div>
                  <div className="p-4 bg-warm/5 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Validation Loss</div>
                    <div className="text-2xl font-mono font-bold text-warm">
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

          {/* Additional visualizations placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                PCA Projection
              </h3>
              <div className="h-40 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">PCA heatmap (WP7)</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Feature Heatmap
              </h3>
              <div className="h-40 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">2D slice view (WP8)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
