import { useState, useRef, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { useModelStore } from '../../stores/modelStore';
import { useFeatureStore, type FeatureDefinition } from '../../stores/featureStore';
import type { ActivationFunction } from '../../types';

const ACTIVATION_OPTIONS: { value: ActivationFunction; label: string }[] = [
  { value: 'relu', label: 'ReLU' },
  { value: 'sigmoid', label: 'Sigmoid' },
  { value: 'tanh', label: 'Tanh' },
  { value: 'leakyRelu', label: 'Leaky ReLU' },
];

const LEARNING_RATE_PRESETS = [0.1, 0.01, 0.001, 0.0001];

interface ConfigPanelProps {
  onTrain: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  dataReady: boolean;
}

/**
 * Feature type badge component
 */
function TypeBadge({ type }: { type: FeatureDefinition['type'] }) {
  const colors = {
    original: 'bg-blue-100 text-blue-700',
    transformed: 'bg-purple-100 text-purple-700',
    pca: 'bg-green-100 text-green-700',
  };

  const labels = {
    original: 'Orig',
    transformed: 'Trans',
    pca: 'PCA',
  };

  return (
    <span className={`text-xs px-1 py-0.5 rounded ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

/**
 * Multi-select dropdown for input features
 */
function InputFeatureSelector({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { getAllFeatures } = useFeatureStore();

  const allFeatures = getAllFeatures();

  // Sort features: original first, then transformed, then PCA
  const sortedFeatures = [...allFeatures].sort((a, b) => {
    const typeOrder = { original: 0, transformed: 1, pca: 2 };
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFeature = (featureId: string) => {
    if (disabled) return;
    const isDeselecting = selectedIds.includes(featureId);
    // Prevent deselecting below 1
    if (isDeselecting && selectedIds.length <= 1) return;
    const newSelection = isDeselecting
      ? selectedIds.filter(id => id !== featureId)
      : [...selectedIds, featureId];
    onChange(newSelection);
  };

  const selectOriginalOnly = () => {
    if (disabled) return;
    const originalIds = sortedFeatures
      .filter(f => f.type === 'original')
      .map(f => f.id);
    if (originalIds.length > 0) {
      onChange(originalIds);
    }
  };

  const selectedCount = selectedIds.filter(id =>
    sortedFeatures.some(f => f.id === id)
  ).length;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg
                   hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm
                   ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="text-gray-700">
          {selectedCount} feature{selectedCount !== 1 ? 's' : ''} selected
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

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Quick actions */}
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-gray-50 text-xs">
            <button
              onClick={selectOriginalOnly}
              className="text-accent hover:text-primary font-medium"
            >
              Original Only
            </button>
          </div>

          {/* Feature list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {sortedFeatures.map((feature) => {
              const isSelected = selectedIds.includes(feature.id);
              const cannotDeselect = isSelected && selectedIds.length <= 1;

              return (
                <label
                  key={feature.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${
                    isSelected ? 'bg-accent/10' : 'hover:bg-gray-50'
                  } ${cannotDeselect ? 'cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFeature(feature.id)}
                    disabled={cannotDeselect}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="flex-1 truncate text-gray-700" title={feature.name}>
                    {feature.name}
                  </span>
                  <TypeBadge type={feature.type} />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dropdown for selecting target feature
 */
function TargetFeatureSelector({
  selectedId,
  onChange,
  disabled,
}: {
  selectedId: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const { getValidTargetFeatures } = useFeatureStore();

  const targetFeatures = getValidTargetFeatures();

  return (
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm
                 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {targetFeatures.map((feature) => (
        <option key={feature.id} value={feature.id}>
          {feature.name}
          {feature.type !== 'original' && ` (${feature.type})`}
        </option>
      ))}
    </select>
  );
}

export function ConfigPanel({ onTrain, onPause, onStop, onReset, dataReady }: ConfigPanelProps) {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const rawData = useDataStore(state => state.rawData);
  const randomSeed = useDataStore(state => state.randomSeed);
  const setRandomSeed = useDataStore(state => state.setRandomSeed);
  const config = useModelStore(state => state.config);
  const setConfig = useModelStore(state => state.setConfig);
  const updateLayerConfig = useModelStore(state => state.updateLayerConfig);
  const addLayer = useModelStore(state => state.addLayer);
  const removeLayer = useModelStore(state => state.removeLayer);
  const trainingStatus = useModelStore(state => state.trainingStatus);
  const setDropoutMode = useModelStore(state => state.setDropoutMode);
  const setGlobalDropout = useModelStore(state => state.setGlobalDropout);
  const predictionUpdateInterval = useModelStore(state => state.predictionUpdateInterval);
  const setPredictionUpdateInterval = useModelStore(state => state.setPredictionUpdateInterval);
  const trainingInputFeatureIds = useModelStore(state => state.trainingInputFeatureIds);
  const trainingTargetFeatureId = useModelStore(state => state.trainingTargetFeatureId);
  const setTrainingInputFeatureIds = useModelStore(state => state.setTrainingInputFeatureIds);
  const setTrainingTargetFeatureId = useModelStore(state => state.setTrainingTargetFeatureId);

  const featureStoreInitialized = useFeatureStore(state => state.initialized);

  const isTraining = trainingStatus === 'training';
  const isPaused = trainingStatus === 'paused';
  const canTrain = dataReady && (trainingStatus === 'idle' || trainingStatus === 'complete' || trainingStatus === 'error' || trainingStatus === 'paused');
  const canPause = trainingStatus === 'training';
  const canStop = trainingStatus === 'training' || trainingStatus === 'paused';
  const canReset = trainingStatus !== 'idle';

  const trainingControlsJSX = (
    <div className="space-y-3">
      <div className="space-y-2">
        <button
          onClick={onTrain}
          disabled={!canTrain}
          data-tutorial="train-button"
          className="w-full py-2.5 sm:py-3 bg-accent text-white text-sm sm:text-base font-semibold rounded-lg
                   hover:bg-accent/90 disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-all duration-200 shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
        >
          {isTraining ? (
            <>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Training...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              {isPaused ? 'Resume Training' : 'Start Training'}
            </>
          )}
        </button>
        {!dataReady && (
          <p className="text-xs text-amber-600 text-center">
            Waiting for dataset to load...
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onPause}
          disabled={!canPause}
          className="py-2 sm:py-2.5 bg-white text-gray-600 text-xs sm:text-sm font-medium rounded-lg
                   border-2 border-gray-200 hover:border-yellow-400 hover:text-yellow-600
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Pause
        </button>

        <button
          onClick={onStop}
          disabled={!canStop}
          className="py-2 sm:py-2.5 bg-white text-gray-600 text-xs sm:text-sm font-medium rounded-lg
                   border-2 border-gray-200 hover:border-red-400 hover:text-red-600
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          Stop
        </button>
      </div>

      <button
        onClick={onReset}
        disabled={!canReset}
        className="w-full py-2 sm:py-2.5 bg-white text-gray-600 text-xs sm:text-sm font-medium rounded-lg
                 border-2 border-gray-200 hover:border-red-300 hover:text-red-600
                 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2"
      >
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reset Model
      </button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Training Controls */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
        {trainingControlsJSX}
      </section>

      {/* Feature Selection Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-accent/10 text-accent flex items-center justify-center text-xs sm:text-sm font-bold">1</span>
          Feature Selection
        </h3>

        {!featureStoreInitialized ? (
          <div className="text-sm text-gray-500 py-2">Loading features...</div>
        ) : (
          <div className="space-y-4">
            {/* Input Features */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Features
              </label>
              <InputFeatureSelector
                selectedIds={trainingInputFeatureIds}
                onChange={setTrainingInputFeatureIds}
                disabled={isTraining}
              />
              <p className="text-xs text-gray-500 mt-1">
                Select features to use as model inputs
              </p>
            </div>

            {/* Target Feature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Variable
              </label>
              <TargetFeatureSelector
                selectedId={trainingTargetFeatureId}
                onChange={setTrainingTargetFeatureId}
                disabled={isTraining}
              />
            </div>

            {/* Hint to Feature Engineering */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                <strong>Tip:</strong> Create transformed or PCA features in the{' '}
                <span className="font-semibold">Explore → Feature Engineering</span> section,
                then select them here for training.
              </p>
            </div>

            <div className="text-xs text-gray-500">
              Dataset: {rawData.length} samples
            </div>
          </div>
        )}
      </section>

      {/* Architecture Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-accent/10 text-accent flex items-center justify-center text-xs sm:text-sm font-bold">2</span>
          Network Architecture
        </h3>

        {/* Dropout Mode Toggle */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Dropout Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setDropoutMode('global')}
              disabled={isTraining}
              className={`flex-1 py-1.5 px-3 rounded-lg border-2 transition-all text-xs font-medium ${
                config.dropoutMode === 'global'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              } ${isTraining ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Global
            </button>
            <button
              onClick={() => setDropoutMode('per-layer')}
              disabled={isTraining}
              className={`flex-1 py-1.5 px-3 rounded-lg border-2 transition-all text-xs font-medium ${
                config.dropoutMode === 'per-layer'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              } ${isTraining ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Per-Layer
            </button>
          </div>
        </div>

        {/* Input layer indicator */}
        <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Input Layer</span>
            <span className="text-sm text-gray-500">{trainingInputFeatureIds.length} feature{trainingInputFeatureIds.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Hidden layers */}
        <div className="space-y-2">
          {config.hiddenLayers.map((layer, index) => (
            <div
              key={index}
              className="px-3 py-3 bg-accent/5 rounded-lg border border-accent/20"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Hidden Layer {index + 1}</span>
                {config.hiddenLayers.length > 1 && (
                  <button
                    onClick={() => removeLayer(index)}
                    disabled={isTraining}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Remove layer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Neurons</label>
                  <input
                    type="number"
                    min={1}
                    max={256}
                    value={layer.neurons}
                    onChange={(e) => updateLayerConfig(index, { neurons: Math.max(1, Math.min(256, parseInt(e.target.value) || 1)) })}
                    disabled={isTraining}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Activation</label>
                  <select
                    value={layer.activation}
                    onChange={(e) => updateLayerConfig(index, { activation: e.target.value as ActivationFunction })}
                    disabled={isTraining}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 disabled:bg-gray-50"
                  >
                    {ACTIVATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Per-layer dropout (only shown when dropoutMode is per-layer) */}
              {config.dropoutMode === 'per-layer' && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">Dropout Rate</label>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.05}
                    value={layer.dropout ?? 0}
                    onChange={(e) => updateLayerConfig(index, { dropout: parseFloat(e.target.value) })}
                    disabled={isTraining}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-50"
                  />
                  <div className="text-xs text-gray-500 text-right">{((layer.dropout ?? 0) * 100).toFixed(0)}%</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add layer button */}
        {config.hiddenLayers.length < 5 && (
          <button
            onClick={addLayer}
            disabled={isTraining}
            className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-accent hover:text-accent transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Hidden Layer
          </button>
        )}

        {/* Output layer indicator */}
        <div className="mt-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Output Layer</span>
            <span className="text-sm text-gray-500">1 neuron (linear)</span>
          </div>
        </div>
      </section>

      {/* Training Parameters Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-accent/10 text-accent flex items-center justify-center text-xs sm:text-sm font-bold">3</span>
          Training Parameters
        </h3>

        <div className="space-y-4">
          {/* Learning Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Learning Rate</label>
            <div className="flex gap-2 mb-2">
              {LEARNING_RATE_PRESETS.map((rate) => (
                <button
                  key={rate}
                  onClick={() => setConfig({ learningRate: rate })}
                  disabled={isTraining}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    config.learningRate === rate
                      ? 'bg-accent text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {rate}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0.00001}
              max={1}
              step={0.0001}
              value={config.learningRate}
              onChange={(e) => setConfig({ learningRate: parseFloat(e.target.value) || 0.001 })}
              disabled={isTraining}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 disabled:bg-gray-50 font-mono"
            />
          </div>

          {/* Epochs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Epochs: <span className="font-mono text-accent">{config.epochs}</span>
            </label>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={config.epochs}
              onChange={(e) => setConfig({ epochs: parseInt(e.target.value) })}
              disabled={isTraining}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10</span>
              <span>500</span>
            </div>
          </div>

          {/* Batch Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Batch Size: <span className="font-mono text-accent">{config.batchSize}</span>
            </label>
            <input
              type="range"
              min={8}
              max={128}
              step={8}
              value={config.batchSize}
              onChange={(e) => setConfig({ batchSize: parseInt(e.target.value) })}
              disabled={isTraining}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>8</span>
              <span>128</span>
            </div>
          </div>

          {/* Validation Split */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Validation Split: <span className="font-mono text-accent">{(config.validationSplit * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={0.4}
              step={0.05}
              value={config.validationSplit}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setConfig({ validationSplit: value });
                useDataStore.getState().setValidationSplit(value);
              }}
              disabled={isTraining}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Random Seed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Random Seed
            </label>
            <input
              type="number"
              min={0}
              value={randomSeed}
              onChange={(e) => {
                const seed = parseInt(e.target.value) || 0;
                setRandomSeed(seed);
              }}
              disabled={isTraining}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 disabled:bg-gray-50 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Controls train/val split randomization</p>
          </div>

          {/* Prediction Update Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prediction Update: <span className="font-mono text-accent">every {predictionUpdateInterval} epochs</span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={predictionUpdateInterval}
              onChange={(e) => setPredictionUpdateInterval(parseInt(e.target.value))}
              disabled={isTraining}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 (every)</span>
              <span>50</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">How often to update GT vs Pred plots during training</p>
          </div>
        </div>
      </section>

      {/* Regularization Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-accent/10 text-accent flex items-center justify-center text-xs sm:text-sm font-bold">4</span>
          Regularization
        </h3>

        <div className="space-y-4">
          {/* Global Dropout (only shown when dropoutMode is global) */}
          {config.dropoutMode === 'global' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Global Dropout: <span className="font-mono text-accent">{(config.globalDropout * 100).toFixed(0)}%</span>
                {config.globalDropout === 0 && <span className="text-gray-400 ml-1">(off)</span>}
              </label>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={config.globalDropout}
                onChange={(e) => setGlobalDropout(parseFloat(e.target.value))}
                disabled={isTraining}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Applied to all hidden layers</p>
            </div>
          )}

          {/* L1 Regularization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              L1 Regularization: <span className="font-mono text-accent">{config.l1Regularization.toFixed(4)}</span>
              {config.l1Regularization === 0 && <span className="text-gray-400 ml-1">(off)</span>}
            </label>
            <input
              type="range"
              min={0}
              max={0.01}
              step={0.0001}
              value={config.l1Regularization}
              onChange={(e) => setConfig({ l1Regularization: parseFloat(e.target.value) })}
              disabled={isTraining}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-warm disabled:opacity-50"
            />
          </div>

          {/* L2 Regularization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              L2 Regularization: <span className="font-mono text-accent">{config.l2Regularization.toFixed(4)}</span>
              {config.l2Regularization === 0 && <span className="text-gray-400 ml-1">(off)</span>}
            </label>
            <input
              type="range"
              min={0}
              max={0.01}
              step={0.0001}
              value={config.l2Regularization}
              onChange={(e) => setConfig({ l2Regularization: parseFloat(e.target.value) })}
              disabled={isTraining}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-warm disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* Training Controls */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-accent/10 text-accent flex items-center justify-center text-xs sm:text-sm font-bold">5</span>
          Training Controls
        </h3>
        {trainingControlsJSX}
      </section>
    </div>
  );
}
