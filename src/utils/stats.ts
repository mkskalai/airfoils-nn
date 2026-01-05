import type { DataPoint } from '../types';
import { DATA_KEYS, FEATURE_KEYS } from './data';

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    throw new Error('Arrays must have the same non-zero length');
  }

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;

  return sumXY / denominator;
}

/**
 * Calculate correlation matrix for all features and target
 */
export function correlationMatrix(data: DataPoint[]): {
  matrix: number[][];
  labels: string[];
} {
  const keys = DATA_KEYS;
  const n = keys.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  // Extract arrays for each variable
  const arrays = keys.map(key => data.map(d => d[key]));

  // Calculate pairwise correlations
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const corr = pearsonCorrelation(arrays[i], arrays[j]);
        matrix[i][j] = corr;
        matrix[j][i] = corr;
      }
    }
  }

  return { matrix, labels: keys };
}

/**
 * Histogram bin result
 */
export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
  frequency: number;
}

/**
 * Create histogram bins for an array of values
 */
export function histogram(
  values: number[],
  numBins: number = 20,
  range?: [number, number]
): HistogramBin[] {
  if (values.length === 0) return [];

  const min = range ? range[0] : Math.min(...values);
  const max = range ? range[1] : Math.max(...values);
  const binWidth = (max - min) / numBins;

  // Initialize bins
  const bins: HistogramBin[] = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({
      x0: min + i * binWidth,
      x1: min + (i + 1) * binWidth,
      count: 0,
      frequency: 0,
    });
  }

  // Count values in each bin
  for (const value of values) {
    let binIndex = Math.floor((value - min) / binWidth);
    // Handle edge case where value === max
    if (binIndex >= numBins) binIndex = numBins - 1;
    if (binIndex >= 0 && binIndex < numBins) {
      bins[binIndex].count++;
    }
  }

  // Calculate frequencies
  const total = values.length;
  for (const bin of bins) {
    bin.frequency = bin.count / total;
  }

  return bins;
}

/**
 * Get histogram for a specific column
 */
export function columnHistogram(
  data: DataPoint[],
  column: keyof DataPoint,
  numBins: number = 20
): HistogramBin[] {
  const values = data.map(d => d[column]);
  return histogram(values, numBins);
}

/**
 * PCA result
 */
export interface PCAResult {
  /** Projected data (n_samples x n_components) */
  projected: number[][];
  /** Principal components (eigenvectors) */
  components: number[][];
  /** Explained variance ratio for each component */
  explainedVarianceRatio: number[];
  /** Mean of each feature (for centering new data) */
  mean: number[];
  /** Standard deviation of each feature (for scaling new data) */
  std: number[];
}

/**
 * Perform PCA on feature data
 * Projects 5D feature space to specified number of components
 */
export function pca(data: DataPoint[], nComponents: number = 2): PCAResult {
  // Extract feature matrix
  const X = data.map(d => FEATURE_KEYS.map(k => d[k]));
  const n = X.length;
  const p = FEATURE_KEYS.length;

  // Center and scale the data
  const mean: number[] = [];
  const std: number[] = [];

  for (let j = 0; j < p; j++) {
    const col = X.map(row => row[j]);
    const m = col.reduce((a, b) => a + b, 0) / n;
    const s = Math.sqrt(col.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / n);
    mean.push(m);
    std.push(s || 1); // Avoid division by zero
  }

  // Standardize
  const XScaled = X.map(row =>
    row.map((val, j) => (val - mean[j]) / std[j])
  );

  // Compute covariance matrix
  const cov = covarianceMatrix(XScaled);

  // Compute eigenvalues and eigenvectors using power iteration
  const { eigenvalues, eigenvectors } = eigenDecomposition(cov, nComponents);

  // Project data onto principal components
  const projected = XScaled.map(row => {
    return eigenvectors.map(ev => dotProduct(row, ev));
  });

  // Calculate explained variance ratio
  const totalVariance = eigenvalues.reduce((a, b) => a + b, 0);
  const explainedVarianceRatio = eigenvalues.map(ev => ev / totalVariance);

  return {
    projected,
    components: eigenvectors,
    explainedVarianceRatio,
    mean,
    std,
  };
}

/**
 * Project new data points using existing PCA result
 */
export function pcaTransform(
  data: DataPoint[],
  pcaResult: PCAResult
): number[][] {
  const { components, mean, std } = pcaResult;

  return data.map(d => {
    // Extract and standardize features
    const features = FEATURE_KEYS.map((k, j) => (d[k] - mean[j]) / std[j]);
    // Project onto components
    return components.map(comp => dotProduct(features, comp));
  });
}

/**
 * Inverse PCA transform - convert from PC space back to feature space
 */
export function pcaInverseTransform(
  projected: number[][],
  pcaResult: PCAResult
): number[][] {
  const { components, mean, std } = pcaResult;
  const p = mean.length;

  return projected.map(point => {
    // Reconstruct in standardized space
    const reconstructed = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < point.length; k++) {
        reconstructed[j] += point[k] * components[k][j];
      }
    }
    // Un-standardize
    return reconstructed.map((val, j) => val * std[j] + mean[j]);
  });
}

/**
 * Compute covariance matrix
 */
function covarianceMatrix(X: number[][]): number[][] {
  const n = X.length;
  const p = X[0].length;
  const cov: number[][] = Array(p)
    .fill(null)
    .map(() => Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      const value = sum / (n - 1);
      cov[i][j] = value;
      cov[j][i] = value;
    }
  }

  return cov;
}

/**
 * Eigendecomposition using power iteration with deflation
 * Returns top k eigenvalues and eigenvectors
 */
function eigenDecomposition(
  matrix: number[][],
  k: number
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];
  let A = matrix.map(row => [...row]);

  for (let i = 0; i < Math.min(k, n); i++) {
    const { eigenvalue, eigenvector } = powerIteration(A);
    eigenvalues.push(eigenvalue);
    eigenvectors.push(eigenvector);

    // Deflate matrix
    A = deflate(A, eigenvalue, eigenvector);
  }

  return { eigenvalues, eigenvectors };
}

/**
 * Power iteration to find dominant eigenvalue/eigenvector
 */
function powerIteration(
  matrix: number[][],
  maxIter: number = 1000,
  tolerance: number = 1e-10
): { eigenvalue: number; eigenvector: number[] } {
  const n = matrix.length;
  let v = new Array(n).fill(1 / Math.sqrt(n));

  for (let iter = 0; iter < maxIter; iter++) {
    // Multiply: w = A * v
    const w = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        w[i] += matrix[i][j] * v[j];
      }
    }

    // Normalize
    const norm = Math.sqrt(w.reduce((sum, val) => sum + val * val, 0));
    const vNew = w.map(val => val / norm);

    // Check convergence
    const diff = Math.sqrt(
      v.reduce((sum, val, i) => sum + Math.pow(val - vNew[i], 2), 0)
    );

    v = vNew;

    if (diff < tolerance) break;
  }

  // Final eigenvalue computation
  const Av = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Av[i] += matrix[i][j] * v[j];
    }
  }

  return { eigenvalue: dotProduct(Av, v), eigenvector: v };
}

/**
 * Deflate matrix by removing contribution of found eigenvector
 */
function deflate(
  matrix: number[][],
  eigenvalue: number,
  eigenvector: number[]
): number[][] {
  const n = matrix.length;
  const result: number[][] = [];

  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = matrix[i][j] - eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }

  return result;
}

/**
 * Dot product of two vectors
 */
function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * Calculate kernel density estimate
 */
export function kernelDensityEstimate(
  values: number[],
  bandwidth?: number,
  nPoints: number = 100
): { x: number[]; y: number[] } {
  if (values.length === 0) return { x: [], y: [] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Silverman's rule of thumb for bandwidth
  const std = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - values.reduce((a, b) => a + b, 0) / values.length, 2), 0) /
      values.length
  );
  const h = bandwidth ?? 1.06 * std * Math.pow(values.length, -0.2);

  // Generate evaluation points
  const padding = range * 0.1;
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < nPoints; i++) {
    const xi = min - padding + ((range + 2 * padding) * i) / (nPoints - 1);
    x.push(xi);

    // Gaussian kernel
    let density = 0;
    for (const v of values) {
      const u = (xi - v) / h;
      density += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    }
    y.push(density / (values.length * h));
  }

  return { x, y };
}
