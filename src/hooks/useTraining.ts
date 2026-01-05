import { useRef, useCallback } from 'react';
import { useModelStore, type PredictionPoint } from '../stores/modelStore';
import { useDataStore } from '../stores/dataStore';
import {
  buildModel,
  trainModel,
  createTrainingController,
  predict,
  type TrainingController,
} from '../utils/model';
import { getFeatureMatrix, getTargetVector } from '../utils/data';

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
    setPredictions,
    resetModel,
  } = useModelStore();

  const { trainData, validationData } = useDataStore();

  const startTraining = useCallback(async () => {
    // Validate data
    if (trainData.length === 0 || validationData.length === 0) {
      console.error('No data available for training');
      setTrainingStatus('error');
      return;
    }

    // Validate config
    if (config.hiddenLayers.length === 0) {
      console.error('At least one hidden layer is required');
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
              const trainPreds = predict(model, trainX);
              const valPreds = predict(model, valX);

              const trainPredictions: PredictionPoint[] = trainY.map((gt, i) => ({
                groundTruth: gt,
                predicted: trainPreds[i],
              }));

              const valPredictions: PredictionPoint[] = valY.map((gt, i) => ({
                groundTruth: gt,
                predicted: valPreds[i],
              }));

              setPredictions(trainPredictions, valPredictions);
            }
          },
          onTrainingEnd: () => {
            setTrainingStatus('complete');
            controllerRef.current = null;
          },
          onTrainingError: (error) => {
            console.error('Training error:', error);
            setTrainingStatus('error');
            controllerRef.current = null;
          },
        },
        controller
      );
    } catch (error) {
      console.error('Training failed:', error);
      setTrainingStatus('error');
      controllerRef.current = null;
    }
  }, [
    config,
    predictionUpdateInterval,
    trainData,
    validationData,
    setModel,
    addHistoryEntry,
    clearHistory,
    setCurrentEpoch,
    setTrainingStatus,
    setPredictions,
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
