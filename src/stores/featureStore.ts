import { create } from 'zustand';
import type { DataPoint } from '../types';
import { FEATURE_LABELS } from '../types';
import {
  type TransformType,
  type TransformParams,
  type FeatureStats,
  computeStats,
  applyTransform,
  applyInverseTransform,
  getTransformSuffix,
  hasInverse,
} from '../utils/transforms';
import {
  computePCA,
  generatePCAId,
  generatePCADisplayName,
  generatePCFeatureName,
  reconstructData,
} from '../utils/pca';

// Feature type categories
export type FeatureType = 'original' | 'transformed' | 'pca';

/**
 * Definition of a feature in the feature store
 */
export interface FeatureDefinition {
  id: string;
  name: string;
  type: FeatureType;
  sourceFeatureId?: string; // For transformed features
  sourceFeatureIds?: string[]; // For PCA features
  transform: TransformType;
  transformParams?: TransformParams;
  values: number[];
  stats: FeatureStats;
}

/**
 * PCA result stored in the feature store
 */
export interface PCAResult {
  id: string;
  name: string;
  sourceFeatureIds: string[];
  sourceFeatureNames: string[];
  components: number[][]; // Eigenvectors (loadings) - numComponents x numFeatures
  explainedVariance: number[];
  explainedVarianceRatio: number[];
  cumulativeVarianceRatio: number[];
  projections: number[][]; // Data projected onto PCs - numSamples x numComponents
  mean: number[]; // Mean of each source feature (for centering)
  singularValues: number[];
  numComponents: number;
  createdAt: number; // Timestamp for ordering
}

// Default features for Explore tab UI persistence
const DEFAULT_SCATTER_FEATURES = ['angleOfAttack', 'soundPressureLevel'];
const DEFAULT_PLOT_FEATURES = [
  'frequency', 'angleOfAttack', 'chordLength', 'freeStreamVelocity',
  'suctionSideDisplacementThickness', 'soundPressureLevel'
];

interface FeatureState {
  features: Record<string, FeatureDefinition>;
  pcaResults: Record<string, PCAResult>;
  selectedFeatureIds: string[];
  initialized: boolean;

  // Explore tab UI state (persisted across tab switches)
  exploreScatterFeatureIds: string[];
  exploreCorrFeatureIds: string[];
  exploreDistFeatureIds: string[];
  exploreShowKDE: boolean;
}

interface FeatureActions {
  // Initialization
  initializeFromData: (data: DataPoint[]) => void;
  reset: () => void;

  // Feature CRUD
  addTransformedFeature: (
    sourceFeatureId: string,
    transform: TransformType,
    params?: TransformParams,
    customName?: string
  ) => string | null;
  deleteFeature: (featureId: string) => boolean;

  // Feature selection
  setSelectedFeatureIds: (ids: string[]) => void;
  selectFeature: (id: string) => void;
  deselectFeature: (id: string) => void;
  selectAllOriginal: () => void;

  // Getters
  getFeature: (id: string) => FeatureDefinition | undefined;
  getFeatureValues: (id: string) => number[];
  getOriginalFeatures: () => FeatureDefinition[];
  getTransformedFeatures: () => FeatureDefinition[];
  getPCAFeatures: () => FeatureDefinition[];
  getAllFeatures: () => FeatureDefinition[];
  getSelectedFeatures: () => FeatureDefinition[];
  getValidTargetFeatures: () => FeatureDefinition[]; // Features that can be used as network output

  // Inverse transforms (for prediction/denormalization)
  inverseTransform: (featureId: string, value: number) => number;

  // PCA operations
  runPCA: (
    featureIds: string[],
    numComponents?: number,
    customName?: string
  ) => PCAResult | null;
  savePCAResult: (result: PCAResult) => void;
  savePCAComponents: (
    pcaId: string,
    componentIndices: number[],
    namePrefix?: string
  ) => string[];
  deletePCAResult: (pcaId: string) => void;
  getPCAResult: (pcaId: string) => PCAResult | undefined;
  getAllPCAResults: () => PCAResult[];

  // PCA inverse transform (for prediction)
  inversePCATransform: (
    pcaId: string,
    pcValues: number[]
  ) => number[] | null;

  // Persistence
  exportConfig: () => FeatureStoreConfig;
  importConfig: (config: FeatureStoreConfig) => void;

  // Explore tab UI state setters
  setExploreScatterFeatureIds: (ids: string[]) => void;
  setExploreCorrFeatureIds: (ids: string[]) => void;
  setExploreDistFeatureIds: (ids: string[]) => void;
  setExploreShowKDE: (show: boolean) => void;
}

export type FeatureStore = FeatureState & FeatureActions;

// Configuration for export/import
export interface FeatureStoreConfig {
  version: number;
  transformedFeatures: Array<{
    sourceFeatureId: string;
    transform: TransformType;
    transformParams?: TransformParams;
    customName?: string;
  }>;
  pcaResults: PCAResult[];
  selectedFeatureIds: string[];
}

// Original feature IDs (matching DataPoint keys)
export const ORIGINAL_FEATURE_IDS = [
  'frequency',
  'angleOfAttack',
  'chordLength',
  'freeStreamVelocity',
  'suctionSideDisplacementThickness',
] as const;

export const TARGET_FEATURE_ID = 'soundPressureLevel';

/**
 * Generate a unique ID for a transformed feature
 */
function generateFeatureId(sourceId: string, transform: TransformType, counter: number): string {
  return `${sourceId}_${transform}_${counter}`;
}

/**
 * Generate a display name for a transformed feature
 */
function generateFeatureName(
  sourceName: string,
  transform: TransformType,
  params?: TransformParams
): string {
  const suffix = getTransformSuffix(transform, params);
  return `${sourceName}${suffix}`;
}

const initialState: FeatureState = {
  features: {},
  pcaResults: {},
  selectedFeatureIds: [...ORIGINAL_FEATURE_IDS],
  initialized: false,
  // Explore tab UI state
  exploreScatterFeatureIds: DEFAULT_SCATTER_FEATURES,
  exploreCorrFeatureIds: DEFAULT_PLOT_FEATURES,
  exploreDistFeatureIds: DEFAULT_PLOT_FEATURES,
  exploreShowKDE: true,
};

export const useFeatureStore = create<FeatureStore>((set, get) => ({
  ...initialState,

  initializeFromData: (data: DataPoint[]) => {
    const features: Record<string, FeatureDefinition> = {};

    // Create original feature definitions
    for (const key of [...ORIGINAL_FEATURE_IDS, TARGET_FEATURE_ID] as (keyof DataPoint)[]) {
      const values = data.map(d => d[key]);
      const stats = computeStats(values);

      features[key] = {
        id: key,
        name: FEATURE_LABELS[key],
        type: 'original',
        transform: 'none',
        values,
        stats,
      };
    }

    set({
      features,
      selectedFeatureIds: [...ORIGINAL_FEATURE_IDS],
      initialized: true,
    });
  },

  reset: () => {
    set(initialState);
  },

  addTransformedFeature: (sourceFeatureId, transform, params, customName) => {
    const state = get();
    const sourceFeature = state.features[sourceFeatureId];

    if (!sourceFeature) {
      console.warn(`Source feature not found: ${sourceFeatureId}`);
      return null;
    }

    if (transform === 'none') {
      console.warn('Cannot create transformed feature with "none" transform');
      return null;
    }

    // Generate unique ID
    const existingIds = Object.keys(state.features);
    let counter = 1;
    let id = generateFeatureId(sourceFeatureId, transform, counter);
    while (existingIds.includes(id)) {
      counter++;
      id = generateFeatureId(sourceFeatureId, transform, counter);
    }

    // Compute transformed values
    const values = sourceFeature.values.map(v =>
      applyTransform(v, transform, sourceFeature.stats, params)
    );

    // Compute stats of transformed values
    const stats = computeStats(values);

    // Generate name
    const name = customName || generateFeatureName(sourceFeature.name, transform, params);

    const newFeature: FeatureDefinition = {
      id,
      name,
      type: 'transformed',
      sourceFeatureId,
      transform,
      transformParams: params,
      values,
      stats,
    };

    set({
      features: {
        ...state.features,
        [id]: newFeature,
      },
    });

    return id;
  },

  deleteFeature: (featureId) => {
    const state = get();
    const feature = state.features[featureId];

    if (!feature) {
      console.warn(`Feature not found: ${featureId}`);
      return false;
    }

    // Cannot delete original features
    if (feature.type === 'original') {
      console.warn('Cannot delete original features');
      return false;
    }

    // Check if any other features depend on this one
    const dependentFeatures = Object.values(state.features).filter(
      f => f.sourceFeatureId === featureId || f.sourceFeatureIds?.includes(featureId)
    );

    if (dependentFeatures.length > 0) {
      console.warn(
        `Cannot delete feature with dependents: ${dependentFeatures.map(f => f.name).join(', ')}`
      );
      return false;
    }

    // Remove from features
    const remainingFeatures = Object.fromEntries(
      Object.entries(state.features).filter(([id]) => id !== featureId)
    );

    // Remove from selected if present
    const selectedFeatureIds = state.selectedFeatureIds.filter(id => id !== featureId);

    set({
      features: remainingFeatures as Record<string, FeatureDefinition>,
      selectedFeatureIds,
    });

    return true;
  },

  setSelectedFeatureIds: (ids) => {
    const state = get();
    // Filter to only existing feature IDs
    const validIds = ids.filter(id => id in state.features);
    set({ selectedFeatureIds: validIds });
  },

  selectFeature: (id) => {
    const state = get();
    if (id in state.features && !state.selectedFeatureIds.includes(id)) {
      set({ selectedFeatureIds: [...state.selectedFeatureIds, id] });
    }
  },

  deselectFeature: (id) => {
    const state = get();
    set({ selectedFeatureIds: state.selectedFeatureIds.filter(fid => fid !== id) });
  },

  selectAllOriginal: () => {
    set({ selectedFeatureIds: [...ORIGINAL_FEATURE_IDS] });
  },

  getFeature: (id) => get().features[id],

  getFeatureValues: (id) => get().features[id]?.values ?? [],

  getOriginalFeatures: () =>
    Object.values(get().features).filter(f => f.type === 'original'),

  getTransformedFeatures: () =>
    Object.values(get().features).filter(f => f.type === 'transformed'),

  getPCAFeatures: () =>
    Object.values(get().features).filter(f => f.type === 'pca'),

  getAllFeatures: () =>
    Object.values(get().features).filter(f => f.id !== TARGET_FEATURE_ID),

  getSelectedFeatures: () => {
    const state = get();
    return state.selectedFeatureIds
      .map(id => state.features[id])
      .filter((f): f is FeatureDefinition => f !== undefined);
  },

  getValidTargetFeatures: () => {
    const state = get();
    const features = Object.values(state.features);

    // Helper to check if feature is derived from target
    const isDerivedFromTarget = (f: FeatureDefinition): boolean => {
      if (f.id === TARGET_FEATURE_ID) return true;
      if (f.sourceFeatureId === TARGET_FEATURE_ID) return true;
      // Check chain: if source is also derived from target
      if (f.sourceFeatureId) {
        const source = state.features[f.sourceFeatureId];
        if (source) return isDerivedFromTarget(source);
      }
      return false;
    };

    return features.filter(f => {
      // Must be derived from target
      if (!isDerivedFromTarget(f)) return false;
      // Must have invertible transform
      return hasInverse(f.transform, f.transformParams);
    });
  },

  inverseTransform: (featureId, value) => {
    const state = get();
    const feature = state.features[featureId];

    if (!feature) {
      console.warn(`Feature not found: ${featureId}`);
      return value;
    }

    if (feature.type === 'original' || feature.transform === 'none') {
      return value;
    }

    if (feature.type === 'transformed' && feature.sourceFeatureId) {
      const sourceFeature = state.features[feature.sourceFeatureId];
      if (sourceFeature) {
        return applyInverseTransform(
          value,
          feature.transform,
          sourceFeature.stats,
          feature.transformParams
        );
      }
    }

    // For PCA features, inverse transform is more complex (handled in WP-FE2)
    return value;
  },

  // PCA methods
  runPCA: (featureIds, numComponents, customName) => {
    const state = get();

    // Validate feature IDs
    const validFeatures = featureIds
      .map(id => state.features[id])
      .filter((f): f is FeatureDefinition => f !== undefined);

    if (validFeatures.length < 2) {
      console.warn('PCA requires at least 2 features');
      return null;
    }

    // Build data matrix from selected features
    const nSamples = validFeatures[0].values.length;
    const data: number[][] = [];

    for (let i = 0; i < nSamples; i++) {
      const row: number[] = [];
      for (const feature of validFeatures) {
        row.push(feature.values[i]);
      }
      data.push(row);
    }

    // Run PCA
    const featureNames = validFeatures.map(f => f.name);
    const nComponents = numComponents ?? validFeatures.length;

    try {
      const pcaOutput = computePCA({
        data,
        featureNames,
        numComponents: nComponents,
      });

      // Generate unique ID and name
      const id = generatePCAId();
      const name = generatePCADisplayName(customName, featureNames);

      const result: PCAResult = {
        id,
        name,
        sourceFeatureIds: validFeatures.map(f => f.id),
        sourceFeatureNames: featureNames,
        components: pcaOutput.components,
        explainedVariance: pcaOutput.explainedVariance,
        explainedVarianceRatio: pcaOutput.explainedVarianceRatio,
        cumulativeVarianceRatio: pcaOutput.cumulativeVarianceRatio,
        projections: pcaOutput.projections,
        mean: pcaOutput.mean,
        singularValues: pcaOutput.singularValues,
        numComponents: nComponents,
        createdAt: Date.now(),
      };

      // Save the result
      set({
        pcaResults: {
          ...state.pcaResults,
          [id]: result,
        },
      });

      return result;
    } catch (error) {
      console.error('PCA computation failed:', error);
      return null;
    }
  },

  savePCAResult: (result) => {
    const state = get();
    set({
      pcaResults: {
        ...state.pcaResults,
        [result.id]: result,
      },
    });
  },

  savePCAComponents: (pcaId, componentIndices, namePrefix) => {
    const state = get();
    const pcaResult = state.pcaResults[pcaId];

    if (!pcaResult) {
      console.warn(`PCA result not found: ${pcaId}`);
      return [];
    }

    const newFeatures: Record<string, FeatureDefinition> = {};
    const createdIds: string[] = [];

    // Use provided prefix or fall back to PCA name
    const prefix = namePrefix || pcaResult.name;

    for (const index of componentIndices) {
      if (index < 0 || index >= pcaResult.numComponents) {
        console.warn(`Invalid component index: ${index}`);
        continue;
      }

      // Generate unique ID - include counter to handle multiple saves
      let counter = 1;
      let id = `${pcaId}_pc${index + 1}`;
      while (state.features[id] || newFeatures[id]) {
        id = `${pcaId}_pc${index + 1}_${counter}`;
        counter++;
      }

      const values = pcaResult.projections.map(row => row[index]);
      const stats = computeStats(values);

      // Generate feature name with variance info
      const name = generatePCFeatureName(
        prefix,
        index,
        pcaResult.explainedVarianceRatio[index]
      );

      newFeatures[id] = {
        id,
        name,
        type: 'pca',
        sourceFeatureIds: pcaResult.sourceFeatureIds,
        transform: 'none',
        values,
        stats,
      };

      createdIds.push(id);
    }

    set({
      features: {
        ...state.features,
        ...newFeatures,
      },
    });

    return createdIds;
  },

  deletePCAResult: (pcaId) => {
    const state = get();
    const remainingPCA = Object.fromEntries(
      Object.entries(state.pcaResults).filter(([id]) => id !== pcaId)
    );

    // Also remove any PCA features derived from this result
    const featuresToRemove = Object.values(state.features)
      .filter(f => f.type === 'pca' && f.id.startsWith(`${pcaId}_`))
      .map(f => f.id);

    const remainingFeatures = Object.fromEntries(
      Object.entries(state.features).filter(([id]) => !featuresToRemove.includes(id))
    );

    const selectedFeatureIds = state.selectedFeatureIds.filter(
      id => !featuresToRemove.includes(id)
    );

    set({
      pcaResults: remainingPCA as Record<string, PCAResult>,
      features: remainingFeatures as Record<string, FeatureDefinition>,
      selectedFeatureIds,
    });
  },

  getPCAResult: (pcaId) => get().pcaResults[pcaId],

  getAllPCAResults: () => {
    const state = get();
    return Object.values(state.pcaResults).sort((a, b) => b.createdAt - a.createdAt);
  },

  inversePCATransform: (pcaId, pcValues) => {
    const state = get();
    const pcaResult = state.pcaResults[pcaId];

    if (!pcaResult) {
      console.warn(`PCA result not found: ${pcaId}`);
      return null;
    }

    // Reconstruct original feature values from PC values
    try {
      const reconstructed = reconstructData(
        [pcValues],
        pcaResult.mean,
        pcaResult.components
      );
      return reconstructed[0];
    } catch (error) {
      console.error('PCA inverse transform failed:', error);
      return null;
    }
  },

  exportConfig: () => {
    const state = get();
    const transformedFeatures = Object.values(state.features)
      .filter(f => f.type === 'transformed')
      .map(f => ({
        sourceFeatureId: f.sourceFeatureId!,
        transform: f.transform,
        transformParams: f.transformParams,
        customName: f.name,
      }));

    return {
      version: 1,
      transformedFeatures,
      pcaResults: Object.values(state.pcaResults),
      selectedFeatureIds: state.selectedFeatureIds,
    };
  },

  importConfig: (config) => {
    const state = get();

    if (!state.initialized) {
      console.warn('Feature store not initialized with data');
      return;
    }

    // Recreate transformed features
    for (const tf of config.transformedFeatures) {
      get().addTransformedFeature(
        tf.sourceFeatureId,
        tf.transform,
        tf.transformParams,
        tf.customName
      );
    }

    // Restore PCA results
    for (const pca of config.pcaResults) {
      get().savePCAResult(pca);
    }

    // Restore selection (filtering for valid IDs)
    const validIds = config.selectedFeatureIds.filter(id => id in get().features);
    set({ selectedFeatureIds: validIds });
  },

  // Explore tab UI state setters
  setExploreScatterFeatureIds: (ids) => set({ exploreScatterFeatureIds: ids }),
  setExploreCorrFeatureIds: (ids) => set({ exploreCorrFeatureIds: ids }),
  setExploreDistFeatureIds: (ids) => set({ exploreDistFeatureIds: ids }),
  setExploreShowKDE: (show) => set({ exploreShowKDE: show }),
}));

/**
 * Helper hook to get feature values as a 2D matrix for selected features
 */
export function getFeatureMatrix(
  features: FeatureDefinition[],
  dataLength: number
): number[][] {
  const matrix: number[][] = [];

  for (let i = 0; i < dataLength; i++) {
    const row: number[] = [];
    for (const feature of features) {
      row.push(feature.values[i] ?? 0);
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Get the target feature (sound pressure level)
 */
export function useTargetFeature(): FeatureDefinition | undefined {
  return useFeatureStore(state => state.features[TARGET_FEATURE_ID]);
}
