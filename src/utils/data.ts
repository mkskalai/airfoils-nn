import type { DataPoint, DatasetStats, NormalizationType, ColumnStats, NormalizationConfig, FeatureNormalization } from '../types';
import { FEATURE_NAMES } from '../types';

export const DATA_KEYS: (keyof DataPoint)[] = [
  'frequency',
  'angleOfAttack',
  'chordLength',
  'freeStreamVelocity',
  'suctionSideDisplacementThickness',
  'soundPressureLevel',
];

export const FEATURE_KEYS: (keyof Omit<DataPoint, 'soundPressureLevel'>)[] = [
  'frequency',
  'angleOfAttack',
  'chordLength',
  'freeStreamVelocity',
  'suctionSideDisplacementThickness',
];

/**
 * Calculate statistics for a dataset
 */
export function calculateStats(data: DataPoint[]): DatasetStats {
  const stats: Partial<DatasetStats> = {};

  for (const key of DATA_KEYS) {
    const values = data.map(d => d[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    stats[key] = { min, max, mean, std };
  }

  return stats as DatasetStats;
}

/**
 * Parse and evaluate a custom transform expression
 * Supported variables: x, min, max, mean, std
 * Supported functions: log, log10, sqrt, abs, exp, sin, cos, pow
 * Example expressions: "log(x+1)", "sqrt(x)", "(x-min)/(max-min)", "pow(x, 2)"
 */
export function evaluateCustomTransform(
  expression: string,
  value: number,
  stats: ColumnStats
): number {
  try {
    // Create a safe evaluation context
    const context: Record<string, number | ((n: number) => number) | ((base: number, exp: number) => number)> = {
      x: value,
      min: stats.min,
      max: stats.max,
      mean: stats.mean,
      std: stats.std,
      log: Math.log,
      log10: Math.log10,
      sqrt: Math.sqrt,
      abs: Math.abs,
      exp: Math.exp,
      sin: Math.sin,
      cos: Math.cos,
      pow: Math.pow,
      PI: Math.PI,
      E: Math.E,
    };

    // Simple expression parser - replace variables and evaluate
    let expr = expression;

    // Replace function calls and variables
    const keys = Object.keys(context).sort((a, b) => b.length - a.length); // Sort by length to avoid partial replacements
    for (const key of keys) {
      const val = context[key];
      if (typeof val === 'number') {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), `(${val})`);
      }
    }

    // Validate expression - only allow safe characters
    if (!/^[\d\s+\-*/().,logqrtabsexpsincowPIE]+$/.test(expr)) {
      console.warn('Invalid characters in transform expression:', expression);
      return value;
    }

    // Use Function constructor for evaluation (safer than eval)
    const fn = new Function('Math', `return ${expr}`);
    const result = fn(Math);

    return isNaN(result) || !isFinite(result) ? value : result;
  } catch (e) {
    console.warn('Error evaluating transform:', expression, e);
    return value;
  }
}

/**
 * Validate a custom transform expression
 * Returns null if valid, error message if invalid
 */
export function validateCustomTransform(expression: string): string | null {
  if (!expression.trim()) {
    return 'Expression cannot be empty';
  }

  // Check for balanced parentheses
  let balance = 0;
  for (const char of expression) {
    if (char === '(') balance++;
    if (char === ')') balance--;
    if (balance < 0) return 'Unbalanced parentheses';
  }
  if (balance !== 0) return 'Unbalanced parentheses';

  // Try to evaluate with test values
  try {
    const testStats: ColumnStats = { min: 0, max: 100, mean: 50, std: 25 };
    const result = evaluateCustomTransform(expression, 50, testStats);
    if (isNaN(result) || !isFinite(result)) {
      return 'Expression produces invalid result';
    }
  } catch (e) {
    return `Invalid expression: ${e instanceof Error ? e.message : 'unknown error'}`;
  }

  return null;
}

/**
 * Normalize a single value
 */
export function normalizeValue(
  value: number,
  stats: ColumnStats,
  type: NormalizationType,
  customTransform?: string
): number {
  if (type === 'none') return value;

  if (type === 'minmax') {
    const range = stats.max - stats.min;
    return range === 0 ? 0 : (value - stats.min) / range;
  }

  if (type === 'zscore') {
    return stats.std === 0 ? 0 : (value - stats.mean) / stats.std;
  }

  if (type === 'custom' && customTransform) {
    return evaluateCustomTransform(customTransform, value, stats);
  }

  return value;
}

/**
 * Denormalize a single value back to original scale
 */
export function denormalizeValue(
  normalizedValue: number,
  stats: ColumnStats,
  type: NormalizationType
): number {
  if (type === 'none') return normalizedValue;

  if (type === 'minmax') {
    return normalizedValue * (stats.max - stats.min) + stats.min;
  }

  if (type === 'zscore') {
    return normalizedValue * stats.std + stats.mean;
  }

  return normalizedValue;
}

/**
 * Normalize an entire data point
 */
export function normalizeDataPoint(
  point: DataPoint,
  stats: DatasetStats,
  type: NormalizationType
): DataPoint {
  if (type === 'none') return { ...point };

  const normalized: Partial<DataPoint> = {};
  for (const key of DATA_KEYS) {
    normalized[key] = normalizeValue(point[key], stats[key], type);
  }
  return normalized as DataPoint;
}

/**
 * Denormalize an entire data point back to original scale
 */
export function denormalizeDataPoint(
  point: DataPoint,
  stats: DatasetStats,
  type: NormalizationType
): DataPoint {
  if (type === 'none') return { ...point };

  const denormalized: Partial<DataPoint> = {};
  for (const key of DATA_KEYS) {
    denormalized[key] = denormalizeValue(point[key], stats[key], type);
  }
  return denormalized as DataPoint;
}

/**
 * Normalize an entire dataset
 */
export function normalizeData(
  data: DataPoint[],
  stats: DatasetStats,
  type: NormalizationType
): DataPoint[] {
  if (type === 'none') return data;
  return data.map(point => normalizeDataPoint(point, stats, type));
}

/**
 * Normalize data with per-feature configuration
 */
export function normalizeDataWithConfig(
  data: DataPoint[],
  stats: DatasetStats,
  config: NormalizationConfig
): DataPoint[] {
  return data.map(point => {
    const normalized: Partial<DataPoint> = {};

    // Normalize features
    for (const key of FEATURE_NAMES) {
      const featureConfig = config.mode === 'global'
        ? config.global
        : config.perFeature[key];

      normalized[key] = normalizeValue(
        point[key],
        stats[key],
        featureConfig.type,
        featureConfig.customTransform
      );
    }

    // Normalize target
    normalized.soundPressureLevel = normalizeValue(
      point.soundPressureLevel,
      stats.soundPressureLevel,
      config.targetNormalization.type,
      config.targetNormalization.customTransform
    );

    return normalized as DataPoint;
  });
}

/**
 * Create default normalization config
 */
export function createDefaultNormalizationConfig(): NormalizationConfig {
  const defaultFeature: FeatureNormalization = { type: 'minmax' };

  return {
    mode: 'global',
    global: { type: 'minmax' },
    perFeature: {
      frequency: { ...defaultFeature },
      angleOfAttack: { ...defaultFeature },
      chordLength: { ...defaultFeature },
      freeStreamVelocity: { ...defaultFeature },
      suctionSideDisplacementThickness: { ...defaultFeature },
    },
    targetNormalization: { type: 'minmax' },
  };
}

/**
 * Convert a DataPoint to a feature array (for model input)
 */
export function dataPointToFeatures(point: DataPoint): number[] {
  return FEATURE_KEYS.map(key => point[key]);
}

/**
 * Convert feature values to a partial DataPoint (for making predictions)
 */
export function featuresToDataPoint(features: number[]): Omit<DataPoint, 'soundPressureLevel'> {
  return {
    frequency: features[0],
    angleOfAttack: features[1],
    chordLength: features[2],
    freeStreamVelocity: features[3],
    suctionSideDisplacementThickness: features[4],
  };
}

/**
 * Split data into training and validation sets
 * Uses random shuffling with optional seed for reproducibility
 */
export function trainValidationSplit(
  data: DataPoint[],
  validationRatio: number = 0.2,
  seed?: number
): { train: DataPoint[]; validation: DataPoint[] } {
  const shuffled = shuffleArray([...data], seed);
  const splitIndex = Math.floor(shuffled.length * (1 - validationRatio));

  return {
    train: shuffled.slice(0, splitIndex),
    validation: shuffled.slice(splitIndex),
  };
}

/**
 * Fisher-Yates shuffle with optional seed for reproducibility
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const random = seed !== undefined ? seededRandom(seed) : Math.random;

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

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
 * Parse the raw dataset text into DataPoint array
 */
export function parseDataset(text: string): DataPoint[] {
  const lines = text.trim().split('\n');

  return lines.map((line, index) => {
    const values = line.trim().split(/\s+/).map(Number);

    if (values.length !== 6 || values.some(isNaN)) {
      throw new Error(`Invalid data at line ${index + 1}: ${line}`);
    }

    return {
      frequency: values[0],
      angleOfAttack: values[1],
      chordLength: values[2],
      freeStreamVelocity: values[3],
      suctionSideDisplacementThickness: values[4],
      soundPressureLevel: values[5],
    };
  });
}

/**
 * Get features as a 2D array suitable for TensorFlow.js
 */
export function getFeatureMatrix(data: DataPoint[]): number[][] {
  return data.map(dataPointToFeatures);
}

/**
 * Get targets as a 1D array suitable for TensorFlow.js
 */
export function getTargetVector(data: DataPoint[]): number[] {
  return data.map(d => d.soundPressureLevel);
}
