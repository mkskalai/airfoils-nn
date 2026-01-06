import { useRef, useCallback } from 'react';
import { useModelStore, type PredictionPoint } from '../stores/modelStore';
import { useDataStore } from '../stores/dataStore';
import {
  buildModel,
  trainModel,
  createTrainingController,
  predict,
  getModelWeights,
  type TrainingController,
} from '../utils/model';
import { getFeatureMatrix, getTargetVector, denormalizeValue, trainValidationSplit } from '../utils/data';

export function useTraining() {
  const controllerRef = useRef<TrainingController | null>(null);

  const {
    config,
    predictionUpdateInterval,
    setModel,
    addHistoryEntry,
    clearHistory,
    setCurrentEpoch,
    setTrainingStatus,
    setTrainingError,
    setPredictions,
    setNetworkWeights,
    resetModel,
  } = useModelStore();

  const { trainData, validationData, rawData, stats, normalizationConfig, validationSplit } = useDataStore();

  const startTraining = useCallback(async () => {
    // Clear any previous errors
    setTrainingError(null);

    // Validate data
    if (trainData.length === 0 || validationData.length === 0) {
      setTrainingError('No data available for training. Please ensure the dataset is loaded.');
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

      // Build the model
      const model = buildModel(config);
      setModel(model);

      // Prepare data
      const trainX = getFeatureMatrix(trainData);
      const trainY = getTargetVector(trainData);
      const valX = getFeatureMatrix(validationData);
      const valY = getTargetVector(validationData);

      // Get target normalization config for denormalization
      const targetNormConfig = normalizationConfig.targetNormalization;
      const targetStats = stats?.soundPressureLevel;

      // Get raw data split (same seed=42 as in data store) for feature values
      const { train: rawTrain, validation: rawVal } = trainValidationSplit(
        rawData,
        validationSplit,
        42
      );

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
                  if (!targetStats) return val;
                  return denormalizeValue(val, targetStats, targetNormConfig.type);
                };

                const trainPredictions: PredictionPoint[] = trainY.map((gt, i) => ({
                  groundTruth: denorm(gt),
                  predicted: denorm(trainPreds[i]),
                  frequency: rawTrain[i].frequency,
                  angleOfAttack: rawTrain[i].angleOfAttack,
                  chordLength: rawTrain[i].chordLength,
                  freeStreamVelocity: rawTrain[i].freeStreamVelocity,
                  suctionSideDisplacementThickness: rawTrain[i].suctionSideDisplacementThickness,
                }));

                const valPredictions: PredictionPoint[] = valY.map((gt, i) => ({
                  groundTruth: denorm(gt),
                  predicted: denorm(valPreds[i]),
                  frequency: rawVal[i].frequency,
                  angleOfAttack: rawVal[i].angleOfAttack,
                  chordLength: rawVal[i].chordLength,
                  freeStreamVelocity: rawVal[i].freeStreamVelocity,
                  suctionSideDisplacementThickness: rawVal[i].suctionSideDisplacementThickness,
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
    trainData,
    validationData,
    rawData,
    validationSplit,
    stats,
    normalizationConfig,
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
