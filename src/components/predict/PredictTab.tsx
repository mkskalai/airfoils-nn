import { useState, useCallback, useMemo } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useModelStore } from '../../stores/modelStore';
import type { FeatureInputs } from '../../stores/modelStore';
import { useDataStore } from '../../stores/dataStore';
import { FEATURE_NAMES, FEATURE_LABELS } from '../../types';
import type { DataPoint, DatasetStats } from '../../types';
import { normalizeValue, denormalizeValue } from '../../utils/data';
import { formatValue } from '../../utils/colors';
import { InputForm } from './InputForm';
import { PointSelector } from './PointSelector';
import { AirfoilViz } from './AirfoilViz';

interface NearestNeighbor {
  point: DataPoint;
  distance: number;
  index: number;
}

// Find K nearest neighbors using Euclidean distance on normalized features
function findNearestNeighbors(
  inputValues: FeatureInputs,
  data: DataPoint[],
  stats: DatasetStats | null,
  k: number = 5
): NearestNeighbor[] {
  if (!stats || data.length === 0) return [];

  // Normalize input values
  const normalizedInput = FEATURE_NAMES.map(key => {
    const range = stats[key].max - stats[key].min;
    return range === 0 ? 0 : (inputValues[key] - stats[key].min) / range;
  });

  // Calculate distances
  const distances = data.map((point, index) => {
    const normalizedPoint = FEATURE_NAMES.map(key => {
      const range = stats[key].max - stats[key].min;
      return range === 0 ? 0 : (point[key] - stats[key].min) / range;
    });

    const distance = Math.sqrt(
      normalizedInput.reduce((sum, val, i) => sum + Math.pow(val - normalizedPoint[i], 2), 0)
    );

    return { point, distance, index };
  });

  // Sort by distance and return top k
  return distances
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}

export function PredictTab() {
  const {
    model,
    trainingStatus,
    predictInputValues: inputValues,
    predictCurrentPrediction: currentPrediction,
    predictSelectedPointIndex: selectedPointIndex,
    predictHistory: history,
    predictXAxis: xAxis,
    predictYAxis: yAxis,
    setPredictInputValues,
    updatePredictInputValue,
    setPredictCurrentPrediction,
    setPredictSelectedPointIndex,
    addPredictHistoryItem,
    clearPredictHistory,
    setPredictAxes,
  } = useModelStore();
  const { rawData, stats, normalizationConfig } = useDataStore();

  // Local loading/error state (transient, doesn't need persistence)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTrainedModel = model !== null && trainingStatus === 'complete';

  // Handle input change
  const handleInputChange = useCallback((key: keyof Omit<DataPoint, 'soundPressureLevel'>, value: number) => {
    updatePredictInputValue(key, value);
  }, [updatePredictInputValue]);

  // Make prediction
  const makePrediction = useCallback(async () => {
    if (!model || !stats) return;

    setIsLoading(true);
    setError(null);

    try {
      // Normalize inputs
      const normalizedInputs = FEATURE_NAMES.map(key => {
        const featureConfig = normalizationConfig.mode === 'global'
          ? normalizationConfig.global
          : normalizationConfig.perFeature[key];

        return normalizeValue(
          inputValues[key],
          stats[key],
          featureConfig.type,
          featureConfig.customTransform
        );
      });

      // Create tensor and predict
      const inputTensor = tf.tensor2d([normalizedInputs]);
      const predictionTensor = model.predict(inputTensor) as tf.Tensor;
      const normalizedPrediction = (await predictionTensor.data())[0];

      // Denormalize prediction
      const prediction = denormalizeValue(
        normalizedPrediction,
        stats.soundPressureLevel,
        normalizationConfig.targetNormalization.type
      );

      setPredictCurrentPrediction(prediction);

      // Add to history
      addPredictHistoryItem({
        inputs: { ...inputValues },
        prediction,
        actualValue: selectedPointIndex !== null ? rawData[selectedPointIndex]?.soundPressureLevel : undefined,
        timestamp: new Date(),
      });

      // Cleanup tensors
      inputTensor.dispose();
      predictionTensor.dispose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
      setPredictCurrentPrediction(null);
    } finally {
      setIsLoading(false);
    }
  }, [model, stats, normalizationConfig, inputValues, selectedPointIndex, rawData, setPredictCurrentPrediction, addPredictHistoryItem]);

  // Handle point selection from scatterplot
  const handleSelectPoint = useCallback((point: DataPoint, index: number) => {
    setPredictInputValues({
      frequency: point.frequency,
      angleOfAttack: point.angleOfAttack,
      chordLength: point.chordLength,
      freeStreamVelocity: point.freeStreamVelocity,
      suctionSideDisplacementThickness: point.suctionSideDisplacementThickness,
    });
    setPredictSelectedPointIndex(index);
    setPredictCurrentPrediction(null); // Clear prediction until user clicks predict
  }, [setPredictInputValues, setPredictSelectedPointIndex, setPredictCurrentPrediction]);

  // Find nearest neighbors
  const nearestNeighbors = useMemo(
    () => findNearestNeighbors(inputValues, rawData, stats, 5),
    [inputValues, rawData, stats]
  );

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Status Banner */}
      {!hasTrainedModel ? (
        <div className="bg-warm-light border border-warm/30 rounded-xl p-3 sm:p-4 md:p-5 mb-4 sm:mb-6 flex items-center gap-3 sm:gap-4">
          <span className="text-2xl sm:text-3xl">⚠️</span>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-warm">No Trained Model Available</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Please train a model in the "Train Model" tab first to make predictions.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 md:p-5 mb-4 sm:mb-6 flex items-center gap-3 sm:gap-4">
          <span className="text-2xl sm:text-3xl">✅</span>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-green-700">Model Ready</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Your neural network is trained and ready to make predictions.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-1">
          <InputForm
            values={inputValues}
            onChange={handleInputChange}
            stats={stats}
            disabled={!hasTrainedModel}
            onPredict={makePrediction}
          />
        </div>

        {/* Middle Column: Prediction Result & Point Selector */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          {/* Prediction Result */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">📤</span>
              Prediction Result
            </h3>

            {isLoading ? (
              <div className="h-32 sm:h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-accent border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="h-32 sm:h-40 flex flex-col items-center justify-center text-red-500">
                <span className="text-3xl sm:text-4xl mb-2">❌</span>
                <p className="text-sm sm:text-base text-center px-2">{error}</p>
              </div>
            ) : currentPrediction !== null ? (
              <div className="text-center py-2 sm:py-4">
                <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-1 sm:mb-2">
                  {formatValue(currentPrediction, 1)}
                </div>
                <div className="text-xl sm:text-2xl text-gray-500">dB</div>
                <div className="text-xs sm:text-sm text-gray-400 mt-1">Sound Pressure Level</div>

                {/* Comparison with actual value if from selected point */}
                {selectedPointIndex !== null && rawData[selectedPointIndex] && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                      Actual value: <span className="font-semibold text-warm">{formatValue(rawData[selectedPointIndex].soundPressureLevel, 1)} dB</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Error: <span className={`font-semibold ${Math.abs(currentPrediction - rawData[selectedPointIndex].soundPressureLevel) < 3 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatValue(currentPrediction - rawData[selectedPointIndex].soundPressureLevel, 2)} dB
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 sm:h-40 bg-gray-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-200">
                <span className="text-4xl sm:text-5xl mb-2 sm:mb-3 opacity-50">🔊</span>
                <p className="text-gray-400 text-center text-sm sm:text-base">
                  Enter values and click<br />"Predict Sound Level"
                </p>
              </div>
            )}
          </div>

          {/* Airfoil Visualization */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-lg sm:text-xl">✈️</span>
              Airfoil Configuration
            </h3>
            <div className="w-full overflow-hidden">
              <AirfoilViz
                chordLength={inputValues.chordLength}
                angleOfAttack={inputValues.angleOfAttack}
                velocity={inputValues.freeStreamVelocity}
                width={360}
                height={240}
              />
            </div>
          </div>

          {/* Nearest Neighbors */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-lg sm:text-xl">🎯</span>
              Nearest Data Points
            </h3>

            {nearestNeighbors.length > 0 ? (
              <div className="space-y-2">
                {nearestNeighbors.map((nn, i) => (
                  <div
                    key={nn.index}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      nn.index === selectedPointIndex
                        ? 'bg-accent/10 border border-accent/30'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => handleSelectPoint(nn.point, nn.index)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        #{i + 1} Point #{nn.index + 1}
                      </span>
                      <span className="text-sm font-semibold text-warm">
                        {formatValue(nn.point.soundPressureLevel, 1)} dB
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Distance: {formatValue(nn.distance, 4)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No data available</p>
            )}
          </div>
        </div>

        {/* Right Column: Point Selector & History */}
        <div className="lg:col-span-2 xl:col-span-1 space-y-4 sm:space-y-6">
          {/* Point Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-lg sm:text-xl">📍</span>
              Select from Dataset
            </h3>

            {/* Axis selectors */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">X-Axis</label>
                <select
                  value={xAxis}
                  onChange={(e) => setPredictAxes(e.target.value as keyof DataPoint, yAxis)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                >
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Y-Axis</label>
                <select
                  value={yAxis}
                  onChange={(e) => setPredictAxes(xAxis, e.target.value as keyof DataPoint)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                >
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {rawData.length > 0 ? (
              <PointSelector
                data={rawData}
                xKey={xAxis}
                yKey={yAxis}
                width={360}
                height={280}
                onSelectPoint={handleSelectPoint}
                selectedIndex={selectedPointIndex}
                predictedValue={currentPrediction}
              />
            ) : (
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-400">Loading dataset...</p>
              </div>
            )}
          </div>

          {/* Prediction History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-lg sm:text-xl">📜</span>
                History
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearPredictHistory}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => {
                      setPredictInputValues(item.inputs);
                      setPredictCurrentPrediction(item.prediction);
                      setPredictSelectedPointIndex(null);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-primary">
                        {formatValue(item.prediction, 1)} dB
                      </span>
                      <span className="text-xs text-gray-400">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {item.actualValue !== undefined && (
                      <div className="text-xs text-gray-500 mt-1">
                        Actual: {formatValue(item.actualValue, 1)} dB
                        <span className={`ml-2 ${Math.abs(item.prediction - item.actualValue) < 3 ? 'text-green-600' : 'text-red-500'}`}>
                          (Δ {formatValue(item.prediction - item.actualValue, 2)})
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      f={formatValue(item.inputs.frequency, 0)}Hz, α={formatValue(item.inputs.angleOfAttack, 1)}°
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">
                No predictions yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
