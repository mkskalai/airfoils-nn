/**
 * Principal Component Analysis (PCA) using ml-pca library
 *
 * PCA reduces dimensionality by finding orthogonal directions (principal components)
 * that capture the maximum variance in the data.
 */

import { PCA } from 'ml-pca';

export interface PCAInput {
  data: number[][];       // n_samples x n_features matrix
  featureNames: string[]; // Names of input features
  numComponents?: number; // Number of components to compute (default: all)
}

export interface PCAOutput {
  components: number[][];           // numComponents x n_features (loadings/eigenvectors)
  explainedVariance: number[];      // Variance explained by each component
  explainedVarianceRatio: number[]; // Ratio of variance explained (0-1)
  cumulativeVarianceRatio: number[];// Cumulative variance ratio
  projections: number[][];          // n_samples x numComponents (transformed data)
  mean: number[];                   // Mean of each feature (for centering)
  featureNames: string[];           // Names of input features
  singularValues: number[];         // Singular values
}

/**
 * Perform Principal Component Analysis on a data matrix
 *
 * @param input PCA input configuration
 * @returns PCA results including loadings, variance explained, and projections
 */
export function computePCA(input: PCAInput): PCAOutput {
  const { data, featureNames, numComponents } = input;

  if (data.length === 0) {
    throw new Error('Cannot perform PCA on empty data');
  }

  const nSamples = data.length;
  const nFeatures = data[0].length;

  if (nFeatures !== featureNames.length) {
    throw new Error(`Feature count mismatch: data has ${nFeatures} features but ${featureNames.length} names provided`);
  }

  const maxComponents = Math.min(nSamples, nFeatures);
  const nComponents = Math.min(numComponents ?? maxComponents, maxComponents);

  // Perform PCA using ml-pca library
  // scale: false - user should apply transforms manually if scaling is needed
  const pca = new PCA(data, { center: true, scale: false });

  // Get eigenvalues and eigenvectors
  const eigenvalues = pca.getEigenvalues();
  const eigenvectors = pca.getEigenvectors().to2DArray();

  // Extract top components (eigenvectors are columns, need to transpose for our format)
  const components: number[][] = [];
  for (let i = 0; i < nComponents; i++) {
    const component: number[] = [];
    for (let j = 0; j < nFeatures; j++) {
      component.push(eigenvectors[j][i]);
    }
    components.push(component);
  }

  const explainedVariance = eigenvalues.slice(0, nComponents);

  // Total variance is sum of all eigenvalues
  const totalVariance = eigenvalues.reduce((sum, val) => sum + val, 0);

  const explainedVarianceRatio = explainedVariance.map(v =>
    totalVariance > 0 ? v / totalVariance : 0
  );

  // Cumulative variance ratio
  const cumulativeVarianceRatio: number[] = [];
  let cumSum = 0;
  for (const ratio of explainedVarianceRatio) {
    cumSum += ratio;
    cumulativeVarianceRatio.push(cumSum);
  }

  // Get projections (scores)
  const allProjections = pca.predict(data).to2DArray();
  const projections = allProjections.map(row => row.slice(0, nComponents));

  // Get mean used for centering (from the model)
  const pcaModel = pca.toJSON();
  const mean = pcaModel.means;

  // Singular values (sqrt of eigenvalues * (n-1))
  const singularValues = explainedVariance.map(ev =>
    Math.sqrt(Math.max(0, ev) * (nSamples - 1))
  );

  return {
    components,
    explainedVariance,
    explainedVarianceRatio,
    cumulativeVarianceRatio,
    projections,
    mean,
    featureNames,
    singularValues,
  };
}

/**
 * Project new data onto existing principal components
 *
 * @param data New data to project (n_samples x n_features)
 * @param mean Mean used for centering (from original PCA)
 * @param components Principal components (n_components x n_features)
 * @returns Projected data (n_samples x n_components)
 */
export function projectData(
  data: number[][],
  mean: number[],
  components: number[][]
): number[][] {
  const nSamples = data.length;
  const nComponents = components.length;
  const nFeatures = mean.length;

  const projections: number[][] = [];

  for (let i = 0; i < nSamples; i++) {
    const proj: number[] = [];
    for (let j = 0; j < nComponents; j++) {
      let dotProduct = 0;
      for (let k = 0; k < nFeatures; k++) {
        // Center and project
        dotProduct += (data[i][k] - mean[k]) * components[j][k];
      }
      proj.push(dotProduct);
    }
    projections.push(proj);
  }

  return projections;
}

/**
 * Reconstruct data from principal components (inverse transform)
 *
 * @param projections Projected data (n_samples x n_components)
 * @param mean Mean used for centering
 * @param components Principal components (n_components x n_features)
 * @returns Reconstructed data (n_samples x n_features)
 */
export function reconstructData(
  projections: number[][],
  mean: number[],
  components: number[][]
): number[][] {
  const nSamples = projections.length;
  const nComponents = components.length;
  const nFeatures = mean.length;

  const reconstructed: number[][] = [];

  for (let i = 0; i < nSamples; i++) {
    const row: number[] = new Array(nFeatures).fill(0);

    // Reconstruct: sum of (projection[j] * component[j]) + mean
    for (let k = 0; k < nFeatures; k++) {
      let sum = mean[k];
      for (let j = 0; j < nComponents; j++) {
        sum += projections[i][j] * components[j][k];
      }
      row[k] = sum;
    }

    reconstructed.push(row);
  }

  return reconstructed;
}

/**
 * Get feature contributions (loadings) for a specific component
 * Useful for interpreting what each original feature contributes to the PC
 *
 * @param components Principal components matrix
 * @param componentIndex Index of the component (0-based)
 * @param featureNames Names of original features
 * @returns Array of {feature, loading, absLoading} sorted by absolute loading
 */
export function getComponentLoadings(
  components: number[][],
  componentIndex: number,
  featureNames: string[]
): Array<{ feature: string; loading: number; absLoading: number }> {
  if (componentIndex < 0 || componentIndex >= components.length) {
    throw new Error(`Invalid component index: ${componentIndex}`);
  }

  const loadings = components[componentIndex];

  return featureNames
    .map((feature, i) => ({
      feature,
      loading: loadings[i],
      absLoading: Math.abs(loadings[i]),
    }))
    .sort((a, b) => b.absLoading - a.absLoading);
}

/**
 * Determine optimal number of components based on variance threshold
 *
 * @param cumulativeVarianceRatio Cumulative explained variance ratios
 * @param threshold Minimum variance to explain (default: 0.95)
 * @returns Number of components needed to reach threshold
 */
export function getOptimalComponents(
  cumulativeVarianceRatio: number[],
  threshold: number = 0.95
): number {
  for (let i = 0; i < cumulativeVarianceRatio.length; i++) {
    if (cumulativeVarianceRatio[i] >= threshold) {
      return i + 1;
    }
  }
  return cumulativeVarianceRatio.length;
}

/**
 * Generate a unique PCA ID based on timestamp and counter
 */
let pcaCounter = 0;
export function generatePCAId(): string {
  pcaCounter++;
  return `pca_${Date.now()}_${pcaCounter}`;
}

/**
 * Generate a display name for a PCA based on source features
 * If name is provided, use it. Otherwise, generate from source features.
 *
 * @param customName Optional custom name
 * @param sourceFeatureNames Names of source features
 * @returns Display name for the PCA
 */
export function generatePCADisplayName(
  customName?: string,
  sourceFeatureNames?: string[]
): string {
  if (customName) {
    return customName;
  }

  if (!sourceFeatureNames || sourceFeatureNames.length === 0) {
    return `PCA ${pcaCounter}`;
  }

  // Generate name from source features (abbreviated)
  const featureAbbreviations = sourceFeatureNames.map(name => {
    // Take first letter of each word, up to 3 chars
    const words = name.replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
    return words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);
  });

  if (featureAbbreviations.length <= 3) {
    return `PCA(${featureAbbreviations.join(',')})`;
  }

  return `PCA(${featureAbbreviations.slice(0, 2).join(',')}+${sourceFeatureNames.length - 2})`;
}

/**
 * Generate a feature name for a saved PC component
 *
 * @param pcaName Name of the PCA analysis
 * @param componentIndex 0-based component index
 * @param varianceRatio Variance ratio for this component (optional, for display)
 * @returns Feature name for this PC
 */
export function generatePCFeatureName(
  pcaName: string,
  componentIndex: number,
  varianceRatio?: number
): string {
  const pcNum = componentIndex + 1;
  if (varianceRatio !== undefined) {
    const pct = (varianceRatio * 100).toFixed(1);
    return `${pcaName} PC${pcNum} (${pct}%)`;
  }
  return `${pcaName} PC${pcNum}`;
}
