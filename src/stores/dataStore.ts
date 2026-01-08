import { create } from 'zustand';
import type { DataPoint, DatasetStats, NormalizationConfig, FeatureNormalization } from '../types';
import { FEATURE_NAMES } from '../types';
import {
  parseDataset,
  calculateStats,
  normalizeDataWithConfig,
  trainValidationSplit,
  createDefaultNormalizationConfig,
} from '../utils/data';
import { useFeatureStore } from './featureStore';

interface DataState {
  rawData: DataPoint[];
  normalizedData: DataPoint[];
  trainData: DataPoint[];
  validationData: DataPoint[];
  stats: DatasetStats | null;
  normalizationConfig: NormalizationConfig;
  validationSplit: number;
  randomSeed: number;
  isLoading: boolean;
  error: string | null;
}

interface DataActions {
  loadData: () => Promise<void>;
  setNormalizationConfig: (config: Partial<NormalizationConfig>) => void;
  setGlobalNormalization: (norm: FeatureNormalization) => void;
  setFeatureNormalization: (feature: keyof typeof FEATURE_NAMES extends number ? never : (typeof FEATURE_NAMES)[number], norm: FeatureNormalization) => void;
  setTargetNormalization: (norm: FeatureNormalization) => void;
  setNormalizationMode: (mode: 'global' | 'per-feature') => void;
  setValidationSplit: (split: number) => void;
  setRandomSeed: (seed: number) => void;
  resplitData: (seed?: number) => void;
  setError: (error: string | null) => void;
  recomputeNormalization: () => void;
}

type DataStore = DataState & DataActions;

const initialState: DataState = {
  rawData: [],
  normalizedData: [],
  trainData: [],
  validationData: [],
  stats: null,
  normalizationConfig: createDefaultNormalizationConfig(),
  validationSplit: 0.2,
  randomSeed: 42,
  isLoading: false,
  error: null,
};

export const useDataStore = create<DataStore>((set, get) => ({
  ...initialState,

  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}airfoil_self_noise.dat`);
      if (!response.ok) {
        throw new Error('Failed to fetch dataset');
      }
      const text = await response.text();
      const rawData = parseDataset(text);
      const stats = calculateStats(rawData);

      const { normalizationConfig, validationSplit, randomSeed } = get();
      const normalizedData = normalizeDataWithConfig(rawData, stats, normalizationConfig);

      const { train, validation } = trainValidationSplit(
        normalizedData,
        validationSplit,
        randomSeed
      );

      set({
        rawData,
        normalizedData,
        trainData: train,
        validationData: validation,
        stats,
        isLoading: false,
      });

      // Initialize feature store with raw data
      useFeatureStore.getState().initializeFromData(rawData);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  recomputeNormalization: () => {
    const { rawData, stats, normalizationConfig, validationSplit, randomSeed } = get();
    if (stats && rawData.length > 0) {
      const normalizedData = normalizeDataWithConfig(rawData, stats, normalizationConfig);
      const { train, validation } = trainValidationSplit(
        normalizedData,
        validationSplit,
        randomSeed
      );
      set({
        normalizedData,
        trainData: train,
        validationData: validation,
      });
    }
  },

  setNormalizationConfig: (config) => {
    const newConfig = { ...get().normalizationConfig, ...config };
    set({ normalizationConfig: newConfig });
    get().recomputeNormalization();
  },

  setGlobalNormalization: (norm) => {
    const { normalizationConfig } = get();
    set({
      normalizationConfig: {
        ...normalizationConfig,
        global: norm,
      },
    });
    get().recomputeNormalization();
  },

  setFeatureNormalization: (feature, norm) => {
    const { normalizationConfig } = get();
    set({
      normalizationConfig: {
        ...normalizationConfig,
        perFeature: {
          ...normalizationConfig.perFeature,
          [feature]: norm,
        },
      },
    });
    get().recomputeNormalization();
  },

  setTargetNormalization: (norm) => {
    const { normalizationConfig } = get();
    set({
      normalizationConfig: {
        ...normalizationConfig,
        targetNormalization: norm,
      },
    });
    get().recomputeNormalization();
  },

  setNormalizationMode: (mode) => {
    const { normalizationConfig } = get();
    set({
      normalizationConfig: {
        ...normalizationConfig,
        mode,
      },
    });
    get().recomputeNormalization();
  },

  setValidationSplit: (split: number) => {
    const { normalizedData, randomSeed } = get();
    if (normalizedData.length > 0) {
      const { train, validation } = trainValidationSplit(
        normalizedData,
        split,
        randomSeed
      );
      set({
        validationSplit: split,
        trainData: train,
        validationData: validation,
      });
    } else {
      set({ validationSplit: split });
    }
  },

  setRandomSeed: (seed: number) => {
    const { normalizedData, validationSplit } = get();
    if (normalizedData.length > 0) {
      const { train, validation } = trainValidationSplit(
        normalizedData,
        validationSplit,
        seed
      );
      set({
        randomSeed: seed,
        trainData: train,
        validationData: validation,
      });
    } else {
      set({ randomSeed: seed });
    }
  },

  resplitData: (seed?: number) => {
    const { normalizedData, validationSplit } = get();
    if (normalizedData.length > 0) {
      const { train, validation } = trainValidationSplit(
        normalizedData,
        validationSplit,
        seed
      );
      set({
        trainData: train,
        validationData: validation,
      });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
