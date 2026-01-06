import { create } from 'zustand';
import type * as tf from '@tensorflow/tfjs';
import type {
  ModelConfig,
  TrainingStatus,
  TrainingHistory,
  LayerConfig,
  DropoutMode,
} from '../types';

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
  bestValLoss: number | null;
  trainPredictions: PredictionPoint[];
  valPredictions: PredictionPoint[];
  predictionUpdateInterval: number;
  networkWeights: NetworkWeights | null;
}

interface ModelActions {
  setModel: (model: tf.Sequential | null) => void;
  setConfig: (config: Partial<ModelConfig>) => void;
  addHistoryEntry: (entry: TrainingHistory) => void;
  clearHistory: () => void;
  setCurrentEpoch: (epoch: number) => void;
  setTrainingStatus: (status: TrainingStatus) => void;
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

const initialState: ModelState = {
  model: null,
  config: defaultConfig,
  trainingHistory: [],
  currentEpoch: 0,
  trainingStatus: 'idle',
  bestValLoss: null,
  trainPredictions: [],
  valPredictions: [],
  predictionUpdateInterval: 10,
  networkWeights: null,
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
}));
