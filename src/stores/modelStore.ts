import { create } from 'zustand';
import type * as tf from '@tensorflow/tfjs';
import type {
  ModelConfig,
  TrainingStatus,
  TrainingHistory,
  LayerConfig,
  DropoutMode,
  DataPoint,
} from '../types';
import { ORIGINAL_FEATURE_IDS, TARGET_FEATURE_ID } from './featureStore';

// Predict tab types
export type FeatureInputs = Record<keyof Omit<DataPoint, 'soundPressureLevel'>, number>;

export interface PredictionHistoryItem {
  id: number;
  inputs: FeatureInputs;
  prediction: number;
  actualValue?: number;
  timestamp: Date;
}

export interface PredictionPoint {
  groundTruth: number;
  predicted: number;
  // Feature values (original scale for residual vs feature analysis)
  frequency: number;
  angleOfAttack: number;
  chordLength: number;
  freeStreamVelocity: number;
  suctionSideDisplacementThickness: number;
}

// Layer weights: weights matrix and bias vector
export interface LayerWeights {
  weights: number[][]; // [inputSize][outputSize] - weights from input to output neurons
  biases: number[]; // [outputSize] - bias for each output neuron
}

// Network weights for all layers
export type NetworkWeights = LayerWeights[];

interface ModelState {
  model: tf.Sequential | null;
  config: ModelConfig;
  trainingHistory: TrainingHistory[];
  currentEpoch: number;
  trainingStatus: TrainingStatus;
  trainingError: string | null;
  bestValLoss: number | null;
  trainPredictions: PredictionPoint[];
  valPredictions: PredictionPoint[];
  predictionUpdateInterval: number;
  networkWeights: NetworkWeights | null;
  // Training feature selection
  trainingInputFeatureIds: string[];
  trainingTargetFeatureId: string;
  // Error analysis feature selection (for ResidualVsFeature)
  errorAnalysisFeatureIds: string[];
  // Predict tab state (persists across tab switches)
  predictInputValues: FeatureInputs;
  predictCurrentPrediction: number | null;
  predictSelectedPointIndex: number | null;
  predictHistory: PredictionHistoryItem[];
  predictHistoryIdCounter: number;
  predictXAxis: keyof DataPoint;
  predictYAxis: keyof DataPoint;
}

interface ModelActions {
  setModel: (model: tf.Sequential | null) => void;
  setConfig: (config: Partial<ModelConfig>) => void;
  addHistoryEntry: (entry: TrainingHistory) => void;
  clearHistory: () => void;
  setCurrentEpoch: (epoch: number) => void;
  setTrainingStatus: (status: TrainingStatus) => void;
  setTrainingError: (error: string | null) => void;
  setBestValLoss: (loss: number | null) => void;
  setPredictions: (train: PredictionPoint[], val: PredictionPoint[]) => void;
  setPredictionUpdateInterval: (interval: number) => void;
  setNetworkWeights: (weights: NetworkWeights | null) => void;
  resetModel: () => void;
  updateLayerConfig: (index: number, config: Partial<LayerConfig>) => void;
  addLayer: () => void;
  removeLayer: (index: number) => void;
  setDropoutMode: (mode: DropoutMode) => void;
  setGlobalDropout: (rate: number) => void;
  // Training feature selection actions
  setTrainingInputFeatureIds: (ids: string[]) => void;
  setTrainingTargetFeatureId: (id: string) => void;
  setErrorAnalysisFeatureIds: (ids: string[]) => void;
  // Predict tab actions
  setPredictInputValues: (values: FeatureInputs) => void;
  updatePredictInputValue: (key: keyof Omit<DataPoint, 'soundPressureLevel'>, value: number) => void;
  setPredictCurrentPrediction: (prediction: number | null) => void;
  setPredictSelectedPointIndex: (index: number | null) => void;
  addPredictHistoryItem: (item: Omit<PredictionHistoryItem, 'id'>) => void;
  clearPredictHistory: () => void;
  setPredictAxes: (xAxis: keyof DataPoint, yAxis: keyof DataPoint) => void;
}

type ModelStore = ModelState & ModelActions;

const defaultLayerConfig: LayerConfig = {
  neurons: 4,
  activation: 'relu',
};

const defaultConfig: ModelConfig = {
  hiddenLayers: [
    { neurons: 4, activation: 'relu' },
    { neurons: 4, activation: 'relu' },
  ],
  learningRate: 0.001,
  epochs: 100,
  batchSize: 32,
  validationSplit: 0.2,
  l1Regularization: 0,
  l2Regularization: 0,
  dropoutMode: 'global',
  globalDropout: 0,
};

const defaultPredictInputValues: FeatureInputs = {
  frequency: 1000,
  angleOfAttack: 5,
  chordLength: 0.15,
  freeStreamVelocity: 50,
  suctionSideDisplacementThickness: 0.005,
};

const initialState: ModelState = {
  model: null,
  config: defaultConfig,
  trainingHistory: [],
  currentEpoch: 0,
  trainingStatus: 'idle',
  trainingError: null,
  bestValLoss: null,
  trainPredictions: [],
  valPredictions: [],
  predictionUpdateInterval: 10,
  networkWeights: null,
  // Training feature selection
  trainingInputFeatureIds: [...ORIGINAL_FEATURE_IDS],
  trainingTargetFeatureId: TARGET_FEATURE_ID,
  errorAnalysisFeatureIds: [...ORIGINAL_FEATURE_IDS],
  // Predict tab initial state
  predictInputValues: defaultPredictInputValues,
  predictCurrentPrediction: null,
  predictSelectedPointIndex: null,
  predictHistory: [],
  predictHistoryIdCounter: 0,
  predictXAxis: 'frequency',
  predictYAxis: 'angleOfAttack',
};

export const useModelStore = create<ModelStore>((set, get) => ({
  ...initialState,

  setModel: (model) => set({ model }),

  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),

  addHistoryEntry: (entry) => set((state) => ({
    trainingHistory: [...state.trainingHistory, entry],
    bestValLoss: state.bestValLoss === null || entry.valLoss < state.bestValLoss
      ? entry.valLoss
      : state.bestValLoss,
  })),

  clearHistory: () => set({ trainingHistory: [], bestValLoss: null }),

  setCurrentEpoch: (epoch) => set({ currentEpoch: epoch }),

  setTrainingStatus: (status) => set({ trainingStatus: status }),

  setTrainingError: (error) => set({ trainingError: error }),

  setBestValLoss: (loss) => set({ bestValLoss: loss }),

  setPredictions: (train, val) => set({
    trainPredictions: train,
    valPredictions: val,
  }),

  setPredictionUpdateInterval: (interval) => set({ predictionUpdateInterval: interval }),

  setNetworkWeights: (weights) => set({ networkWeights: weights }),

  resetModel: () => {
    const { model } = get();
    if (model) {
      model.dispose();
    }
    set({
      model: null,
      trainingHistory: [],
      currentEpoch: 0,
      trainingStatus: 'idle',
      trainingError: null,
      bestValLoss: null,
      trainPredictions: [],
      valPredictions: [],
      networkWeights: null,
    });
  },

  updateLayerConfig: (index, config) => set((state) => {
    const hiddenLayers = [...state.config.hiddenLayers];
    hiddenLayers[index] = { ...hiddenLayers[index], ...config };
    return { config: { ...state.config, hiddenLayers } };
  }),

  addLayer: () => set((state) => ({
    config: {
      ...state.config,
      hiddenLayers: [...state.config.hiddenLayers, { ...defaultLayerConfig }],
    },
  })),

  removeLayer: (index) => set((state) => ({
    config: {
      ...state.config,
      hiddenLayers: state.config.hiddenLayers.filter((_, i) => i !== index),
    },
  })),

  setDropoutMode: (mode) => set((state) => ({
    config: { ...state.config, dropoutMode: mode },
  })),

  setGlobalDropout: (rate) => set((state) => ({
    config: { ...state.config, globalDropout: rate },
  })),

  // Training feature selection actions
  setTrainingInputFeatureIds: (ids) => set({ trainingInputFeatureIds: ids }),

  setTrainingTargetFeatureId: (id) => set({ trainingTargetFeatureId: id }),

  setErrorAnalysisFeatureIds: (ids) => set({ errorAnalysisFeatureIds: ids }),

  // Predict tab actions
  setPredictInputValues: (values) => set({ predictInputValues: values }),

  updatePredictInputValue: (key, value) => set((state) => ({
    predictInputValues: { ...state.predictInputValues, [key]: value },
    predictSelectedPointIndex: null, // Clear selection when manually editing
  })),

  setPredictCurrentPrediction: (prediction) => set({ predictCurrentPrediction: prediction }),

  setPredictSelectedPointIndex: (index) => set({ predictSelectedPointIndex: index }),

  addPredictHistoryItem: (item) => set((state) => ({
    predictHistory: [
      { ...item, id: state.predictHistoryIdCounter },
      ...state.predictHistory,
    ].slice(0, 20), // Keep last 20
    predictHistoryIdCounter: state.predictHistoryIdCounter + 1,
  })),

  clearPredictHistory: () => set({ predictHistory: [] }),

  setPredictAxes: (xAxis, yAxis) => set({ predictXAxis: xAxis, predictYAxis: yAxis }),
}));
