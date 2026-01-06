/**
 * Transform functions for feature engineering
 * Supports min-max normalization, z-score standardization, and custom transforms
 */

export type TransformType = 'none' | 'minmax' | 'zscore' | 'custom';

export interface TransformParams {
  // Expression for custom transforms (e.g., "log(x+1)", "sqrt(x)", "(x-min)/(max-min)")
  expression?: string;
  // Inverse expression for custom transforms (required for target transforms)
  inverseExpression?: string;
}

/**
 * Known expression → inverse pairs for auto-fill
 */
export const KNOWN_INVERSES: Record<string, string> = {
  'log(x+1)': 'exp(x)-1',
  'log(x)': 'exp(x)',
  'log10(x+1)': 'pow(10,x)-1',
  'log10(x)': 'pow(10,x)',
  'sqrt(x)': 'pow(x,2)',
  'pow(x,2)': 'sqrt(x)',
  'pow(x,0.5)': 'pow(x,2)',
  '(x-min)/(max-min)': 'x*(max-min)+min',
  '(x-mean)/std': 'x*std+mean',
  'exp(x)': 'log(x)',
};

/**
 * Get the known inverse for an expression, or undefined if not known
 */
export function getKnownInverse(expression: string): string | undefined {
  const normalized = expression.replace(/\s+/g, '');
  for (const [expr, inverse] of Object.entries(KNOWN_INVERSES)) {
    if (normalized === expr.replace(/\s+/g, '')) {
      return inverse;
    }
  }
  return undefined;
}

/**
 * Check if a custom transform has an inverse defined
 */
export function hasInverse(transform: TransformType, params?: TransformParams): boolean {
  if (transform === 'none') return true;
  if (transform === 'minmax' || transform === 'zscore') return true;
  if (transform === 'custom') {
    return !!params?.inverseExpression;
  }
  return false;
}

export interface FeatureStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  q1: number;
  median: number;
  q3: number;
  count: number;
}

/**
 * Compute statistics for an array of values
 */
export function computeStats(values: number[]): FeatureStats {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      std: 0,
      q1: 0,
      median: 0,
      q3: 0,
      count: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  // Quartiles using linear interpolation
  const q1 = getQuantile(sorted, 0.25);
  const median = getQuantile(sorted, 0.5);
  const q3 = getQuantile(sorted, 0.75);

  return { min, max, mean, std, q1, median, q3, count: n };
}

/**
 * Get quantile value from sorted array using linear interpolation
 */
function getQuantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];

  const index = p * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Evaluate a custom transform expression
 * Variables available: x (the value), min, max, mean, std
 */
export function evaluateCustomTransform(
  expression: string,
  value: number,
  stats: FeatureStats
): number {
  try {
    // Replace variable names with actual values
    let expr = expression
      .replace(/\bx\b/g, value.toString())
      .replace(/\bmin\b/g, stats.min.toString())
      .replace(/\bmax\b/g, stats.max.toString())
      .replace(/\bmean\b/g, stats.mean.toString())
      .replace(/\bstd\b/g, stats.std.toString());

    // Replace common math functions with Math.* calls
    expr = expr
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\blog\(/g, 'Math.log(')
      .replace(/\blog10\(/g, 'Math.log10(')
      .replace(/\blog2\(/g, 'Math.log2(')
      .replace(/\bexp\(/g, 'Math.exp(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\bsin\(/g, 'Math.sin(')
      .replace(/\bcos\(/g, 'Math.cos(')
      .replace(/\btan\(/g, 'Math.tan(')
      .replace(/\bpow\(/g, 'Math.pow(')
      .replace(/\bfloor\(/g, 'Math.floor(')
      .replace(/\bceil\(/g, 'Math.ceil(')
      .replace(/\bround\(/g, 'Math.round(')
      .replace(/\bPI\b/g, 'Math.PI')
      .replace(/\bE\b/g, 'Math.E');

    // Evaluate the expression safely
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
    const testStats: FeatureStats = {
      min: 0,
      max: 100,
      mean: 50,
      std: 25,
      q1: 25,
      median: 50,
      q3: 75,
      count: 100,
    };
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
 * Apply a transform to a single value
 */
export function applyTransform(
  value: number,
  transform: TransformType,
  stats: FeatureStats,
  params?: TransformParams
): number {
  switch (transform) {
    case 'none':
      return value;

    case 'minmax': {
      const range = stats.max - stats.min;
      return range === 0 ? 0 : (value - stats.min) / range;
    }

    case 'zscore': {
      return stats.std === 0 ? 0 : (value - stats.mean) / stats.std;
    }

    case 'custom': {
      if (params?.expression) {
        return evaluateCustomTransform(params.expression, value, stats);
      }
      return value;
    }

    default:
      return value;
  }
}

/**
 * Apply inverse transform to recover original value
 */
export function applyInverseTransform(
  value: number,
  transform: TransformType,
  stats: FeatureStats,
  params?: TransformParams
): number {
  switch (transform) {
    case 'none':
      return value;

    case 'minmax': {
      return value * (stats.max - stats.min) + stats.min;
    }

    case 'zscore': {
      return value * stats.std + stats.mean;
    }

    case 'custom': {
      if (params?.inverseExpression) {
        return evaluateCustomTransform(params.inverseExpression, value, stats);
      }
      // No inverse defined - return unchanged with warning
      console.warn('Inverse transform not available for custom expression without inverseExpression');
      return value;
    }

    default:
      return value;
  }
}

/**
 * Apply transform to an array of values
 */
export function transformValues(
  values: number[],
  transform: TransformType,
  stats: FeatureStats,
  params?: TransformParams
): number[] {
  return values.map(v => applyTransform(v, transform, stats, params));
}

/**
 * Apply inverse transform to an array of values
 */
export function inverseTransformValues(
  values: number[],
  transform: TransformType,
  stats: FeatureStats,
  params?: TransformParams
): number[] {
  return values.map(v => applyInverseTransform(v, transform, stats, params));
}

/**
 * Get display name for a transform type
 */
export function getTransformDisplayName(transform: TransformType): string {
  switch (transform) {
    case 'none':
      return 'None';
    case 'minmax':
      return 'Min-Max';
    case 'zscore':
      return 'Z-Score';
    case 'custom':
      return 'Custom';
    default:
      return transform;
  }
}

/**
 * Get suffix for transformed feature name
 */
export function getTransformSuffix(transform: TransformType, params?: TransformParams): string {
  switch (transform) {
    case 'none':
      return '';
    case 'minmax':
      return ' (min-max)';
    case 'zscore':
      return ' (z-score)';
    case 'custom':
      if (params?.expression) {
        // Truncate long expressions
        const expr = params.expression;
        const displayExpr = expr.length > 15 ? expr.slice(0, 12) + '...' : expr;
        return ` (${displayExpr})`;
      }
      return ' (custom)';
    default:
      return '';
  }
}
