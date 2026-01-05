import * as d3 from 'd3';

// Theme colors from the design spec
export const THEME_COLORS = {
  deepBlue: '#1a237e',
  deepOrange: '#e65100',
  primary: '#0d47a1',
  accent: '#03a9f4',
  warm: '#f57c00',
  white: '#ffffff',
  background: '#f5f5f5',
} as const;

/**
 * Diverging color scale for correlation values (-1 to 1)
 * Blue (negative) → White (zero) → Orange (positive)
 */
export const correlationColorScale = d3.scaleDiverging<string>()
  .domain([-1, 0, 1])
  .interpolator(d3.interpolateRgbBasis([
    THEME_COLORS.deepBlue,
    THEME_COLORS.white,
    THEME_COLORS.deepOrange,
  ]));

/**
 * Sequential color scale for target values (sound pressure level)
 * Blue (low) → White → Orange (high)
 */
export function createTargetColorScale(domain: [number, number]) {
  const midpoint = (domain[0] + domain[1]) / 2;
  return d3.scaleDiverging<string>()
    .domain([domain[0], midpoint, domain[1]])
    .interpolator(d3.interpolateRgbBasis([
      THEME_COLORS.deepBlue,
      THEME_COLORS.white,
      THEME_COLORS.deepOrange,
    ]));
}

/**
 * Sequential color scale for positive values only
 */
export function createSequentialColorScale(domain: [number, number]) {
  return d3.scaleSequential()
    .domain(domain)
    .interpolator(d3.interpolateBlues);
}

/**
 * Get opacity based on value magnitude (for weight visualization)
 */
export function getWeightOpacity(value: number, maxAbsValue: number): number {
  if (maxAbsValue === 0) return 0.3;
  return 0.3 + 0.7 * (Math.abs(value) / maxAbsValue);
}

/**
 * Get color for neural network weights
 * Positive → Orange, Negative → Blue
 */
export function getWeightColor(value: number): string {
  return value >= 0 ? THEME_COLORS.deepOrange : THEME_COLORS.deepBlue;
}

/**
 * Format number for display in tooltips
 */
export function formatValue(value: number, decimals: number = 2): string {
  if (Math.abs(value) < 0.001 && value !== 0) {
    return value.toExponential(decimals);
  }
  return value.toFixed(decimals);
}
