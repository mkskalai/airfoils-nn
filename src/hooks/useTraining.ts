import { useRef, useCallback } from 'react';
import { useModelStore, type PredictionPoint } from '../stores/modelStore';
import { useDataStore } from '../stores/dataStore';
import { useFeatureStore, ORIGINAL_FEATURE_IDS, type FeatureDefinition } from '../stores/featureStore';
import {
  buildModel,
  trainModel,
  createTrainingController,
  predict,
  getModelWeights,
  type TrainingController,
} from '../utils/model';

/**
 * Simple seeded random number generator (LCG)
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Split indices into train and validation sets
 */
function splitIndices(
  length: number,
  validationRatio: number,
  seed: number
): { train: number[]; validation: number[] } {
  const indices = Array.from({ length }, (_, i) => i);
  const random = seededRandom(seed);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const splitIndex = Math.floor(length * (1 - validationRatio));
  return {
    train: indices.slice(0, splitIndex),
    validation: indices.slice(splitIndex),
  };
}

/**
 * Helper to get feature values for training data
 */
function getFeatureValuesMatrix(
  features: FeatureDefinition[],
  indices: number[]
): number[][] {
  return indices.map(i => features.map(f => f.values[i]));
}

/**
 * Helper to get target values for training data
 */
function getTargetValuesArray(
  targetFeature: FeatureDefinition,
  indices: number[]
): number[] {
  return indices.map(i => targetFeature.values[i]);
}

export function useTraining() {
  const controllerRef = useRef<TrainingController | null>(null);

  // Use individual selectors to avoid re-rendering on unrelated store changes
  const config = useModelStore(state => state.config);
  const predictionUpdateInterval = useModelStore(state => state.predictionUpdateInterval);
  const trainingInputFeatureIds = useModelStore(state => state.trainingInputFeatureIds);
  const trainingTargetFeatureId = useModelStore(state => state.trainingTargetFeatureId);
  const setModel = useModelStore(state => state.setModel);
  const addHistoryEntry = useModelStore(state => state.addHistoryEntry);
  const clearHistory = useModelStore(state => state.clearHistory);
  const setCurrentEpoch = useModelStore(state => state.setCurrentEpoch);
  const setTrainingStatus = useModelStore(state => state.setTrainingStatus);
  const setTrainingError = useModelStore(state => state.setTrainingError);
  const setPredictions = useModelStore(state => state.setPredictions);
  const setNetworkWeights = useModelStore(state => state.setNetworkWeights);
  const resetModel = useModelStore(state => state.resetModel);

  const rawData = useDataStore(state => state.rawData);
  const validationSplit = useDataStore(state => state.validationSplit);
  const getFeature = useFeatureStore(state => state.getFeature);
  const inverseTransform = useFeatureStore(state => state.inverseTransform);
  const featureStoreInitialized = useFeatureStore(state => state.initialized);

  const startTraining = useCallback(async () => {
    // Clear any previous errors
    setTrainingError(null);

    // Validate feature store is initialized
    if (!featureStoreInitialized) {
      setTrainingError('Feature store not initialized. Please wait for data to load.');
      setTrainingStatus('error');
      return;
    }

    // Validate data
    if (rawData.length === 0) {
      setTrainingError('No data available for training. Please ensure the dataset is loaded.');
      setTrainingStatus('error');
      return;
    }

    // Validate input features
    if (trainingInputFeatureIds.length === 0) {
      setTrainingError('At least one input feature must be selected.');
      setTrainingStatus('error');
      return;
    }

    // Get input features from store
    const inputFeatures = trainingInputFeatureIds
      .map(id => getFeature(id))
      .filter((f): f is FeatureDefinition => f !== undefined);

    if (inputFeatures.length !== trainingInputFeatureIds.length) {
      setTrainingError('Some selected input features are not available.');
      setTrainingStatus('error');
      return;
    }

    // Get target feature from store
    const targetFeature = getFeature(trainingTargetFeatureId);
    if (!targetFeature) {
      setTrainingError('Target feature is not available.');
      setTrainingStatus('error');
      return;
    }

    // Validate config
    if (config.hiddenLayers.length === 0) {
      setTrainingError('At least one hidden layer is required. Add a layer in the Network Architecture section.');
      setTrainingStatus('error');
      return;
    }

    // Validate layer neurons
    const invalidLayers = config.hiddenLayers.filter((layer) => layer.neurons < 1);
    if (invalidLayers.length > 0) {
      setTrainingError('All layers must have at least 1 neuron.');
      setTrainingStatus('error');
      return;
    }

    // Validate hyperparameters
    if (config.learningRate <= 0 || config.learningRate > 1) {
      setTrainingError('Learning rate must be between 0 and 1.');
      setTrainingStatus('error');
      return;
    }

    if (config.epochs < 1) {
      setTrainingError('Number of epochs must be at least 1.');
      setTrainingStatus('error');
      return;
    }

    if (config.batchSize < 1) {
      setTrainingError('Batch size must be at least 1.');
      setTrainingStatus('error');
      return;
    }

    try {
      // Reset previous state
      resetModel();
      clearHistory();
      setCurrentEpoch(0);
      setTrainingStatus('training');

      // Build the model with dynamic input size
      const model = buildModel(config, inputFeatures.length);
      setModel(model);

      // Create train/validation split indices (using consistent seed for reproducibility)
      const { train: trainIndices, validation: valIndices } = splitIndices(
        rawData.length,
        validationSplit,
        42
      );

      // Prepare data using feature store values
      const trainX = getFeatureValuesMatrix(inputFeatures, trainIndices);
      const trainY = getTargetValuesArray(targetFeature, trainIndices);
      const valX = getFeatureValuesMatrix(inputFeatures, valIndices);
      const valY = getTargetValuesArray(targetFeature, valIndices);

      // Get original feature values for residual analysis (from feature store)
      const getOriginalFeatureValues = (indices: number[]) => {
        const result: Record<string, number[]> = {};
        for (const featureId of ORIGINAL_FEATURE_IDS) {
          const feature = getFeature(featureId);
          if (feature) {
            result[featureId] = indices.map(i => feature.values[i]);
          }
        }
        return result;
      };

      const trainOriginalFeatures = getOriginalFeatureValues(trainIndices);
      const valOriginalFeatures = getOriginalFeatureValues(valIndices);

      // Create controller
      const controller = createTrainingController();
      controllerRef.current = controller;

      // Capture update interval at start (so it doesn't change mid-training)
      const updateInterval = predictionUpdateInterval;
      const totalEpochs = config.epochs;

      // Train the model
      await trainModel(
        model,
        trainX,
        trainY,
        valX,
        valY,
        config,
        {
          onEpochEnd: (epoch, loss, valLoss) => {
            setCurrentEpoch(epoch);
            addHistoryEntry({ epoch, loss, valLoss });

            // Compute predictions every N epochs or on last epoch
            const isLastEpoch = epoch === totalEpochs;
            const shouldUpdate = epoch % updateInterval === 0 || isLastEpoch;

            if (shouldUpdate) {
              // Defer heavy visualization updates to not block training
              // Using requestAnimationFrame to yield to the browser
              requestAnimationFrame(() => {
                const trainPreds = predict(model, trainX);
                const valPreds = predict(model, valX);

                // Denormalize predictions and ground truth back to original scale
                // so metrics (R², RMSE) reflect real dB values
                const denorm = (val: number) => {
                  return inverseTransform(trainingTargetFeatureId, val);
                };

                const trainPredictions: PredictionPoint[] = trainY.map((gt, i) => ({
                  groundTruth: denorm(gt),
                  predicted: denorm(trainPreds[i]),
                  frequency: trainOriginalFeatures['frequency']?.[i] ?? 0,
                  angleOfAttack: trainOriginalFeatures['angleOfAttack']?.[i] ?? 0,
                  chordLength: trainOriginalFeatures['chordLength']?.[i] ?? 0,
                  freeStreamVelocity: trainOriginalFeatures['freeStreamVelocity']?.[i] ?? 0,
                  suctionSideDisplacementThickness: trainOriginalFeatures['suctionSideDisplacementThickness']?.[i] ?? 0,
                }));

                const valPredictions: PredictionPoint[] = valY.map((gt, i) => ({
                  groundTruth: denorm(gt),
                  predicted: denorm(valPreds[i]),
                  frequency: valOriginalFeatures['frequency']?.[i] ?? 0,
                  angleOfAttack: valOriginalFeatures['angleOfAttack']?.[i] ?? 0,
                  chordLength: valOriginalFeatures['chordLength']?.[i] ?? 0,
                  freeStreamVelocity: valOriginalFeatures['freeStreamVelocity']?.[i] ?? 0,
                  suctionSideDisplacementThickness: valOriginalFeatures['suctionSideDisplacementThickness']?.[i] ?? 0,
                }));

                setPredictions(trainPredictions, valPredictions);

                // Extract and update network weights for visualization
                const weights = getModelWeights(model);
                setNetworkWeights(weights);
              });
            }
          },
          onTrainingEnd: () => {
            setTrainingStatus('complete');
            controllerRef.current = null;
          },
          onTrainingError: (error) => {
            console.error('Training error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Check for common TensorFlow.js errors
            if (errorMessage.includes('NaN') || errorMessage.includes('Infinity')) {
              setTrainingError('Training produced NaN/Infinity values. Try reducing the learning rate or adding regularization.');
            } else if (errorMessage.includes('memory') || errorMessage.includes('OOM')) {
              setTrainingError('Out of memory. Try reducing batch size or model complexity.');
            } else {
              setTrainingError(`Training failed: ${errorMessage}`);
            }
            setTrainingStatus('error');
            controllerRef.current = null;
          },
        },
        controller
      );
    } catch (error) {
      console.error('Training failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTrainingError(`Failed to start training: ${errorMessage}`);
      setTrainingStatus('error');
      controllerRef.current = null;
    }
  }, [
    config,
    predictionUpdateInterval,
    trainingInputFeatureIds,
    trainingTargetFeatureId,
    rawData,
    validationSplit,
    featureStoreInitialized,
    getFeature,
    inverseTransform,
    setModel,
    addHistoryEntry,
    clearHistory,
    setCurrentEpoch,
    setTrainingStatus,
    setTrainingError,
    setPredictions,
    setNetworkWeights,
    resetModel,
  ]);

  const pauseTraining = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.pause();
      setTrainingStatus('paused');
    }
  }, [setTrainingStatus]);

  const resumeTraining = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.resume();
      setTrainingStatus('training');
    }
  }, [setTrainingStatus]);

  const stopTraining = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
      setTrainingStatus('complete');
      controllerRef.current = null;
    }
  }, [setTrainingStatus]);

  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
      controllerRef.current = null;
    }
    resetModel();
  }, [resetModel]);

  return {
    startTraining,
    pauseTraining,
    resumeTraining,
    stopTraining,
    reset,
  };
}
