/**
 * NACA 4-digit airfoil geometry utilities
 *
 * The NACA 0012 profile is used in the NASA Airfoil Self-Noise Dataset.
 * It's a symmetric airfoil with 12% maximum thickness at 30% chord.
 */

export interface AirfoilPoint {
  x: number;  // Position along chord (0 to chord length)
  y: number;  // Vertical position
}

export interface AirfoilCoordinates {
  upper: AirfoilPoint[];  // Upper surface (from trailing edge to leading edge)
  lower: AirfoilPoint[];  // Lower surface (from leading edge to trailing edge)
  chord: number;          // Chord length
}

/**
 * Generate NACA 4-digit symmetric airfoil coordinates
 *
 * For NACA 00XX airfoils (symmetric), the thickness distribution is:
 * y_t = 5t[0.2969√x - 0.1260x - 0.3516x² + 0.2843x³ - 0.1015x⁴]
 *
 * where t is the maximum thickness as fraction of chord (e.g., 0.12 for NACA 0012)
 * and x is the position along chord from 0 to 1
 *
 * @param thickness - Maximum thickness as fraction of chord (default 0.12 for NACA 0012)
 * @param numPoints - Number of points along each surface
 * @param chordLength - Chord length in meters
 * @returns Upper and lower surface coordinates
 */
export function generateNACAProfile(
  thickness: number = 0.12,
  numPoints: number = 100,
  chordLength: number = 1
): AirfoilCoordinates {
  const t = thickness;

  // Generate points with cosine spacing for better resolution at leading/trailing edges
  const upper: AirfoilPoint[] = [];
  const lower: AirfoilPoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    // Cosine spacing: more points at leading and trailing edges
    const beta = (i / numPoints) * Math.PI;
    const xNorm = 0.5 * (1 - Math.cos(beta)); // 0 to 1

    // NACA symmetric airfoil thickness distribution
    // Modified trailing edge coefficient (-0.1036 instead of -0.1015) for closed trailing edge
    const yt = 5 * t * (
      0.2969 * Math.sqrt(xNorm) -
      0.1260 * xNorm -
      0.3516 * Math.pow(xNorm, 2) +
      0.2843 * Math.pow(xNorm, 3) -
      0.1036 * Math.pow(xNorm, 4)
    );

    // Scale by chord length
    const x = xNorm * chordLength;
    const y = yt * chordLength;

    upper.push({ x, y });
    lower.push({ x, y: -y });
  }

  return { upper, lower, chord: chordLength };
}

/**
 * Rotate airfoil coordinates around the quarter-chord point (typical rotation center)
 * Positive angle = nose up (counterclockwise in standard coordinates)
 *
 * @param coords - Original airfoil coordinates
 * @param angleDegrees - Angle of attack in degrees
 * @returns Rotated coordinates
 */
export function rotateAirfoil(
  coords: AirfoilCoordinates,
  angleDegrees: number
): AirfoilCoordinates {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Rotation center at quarter-chord
  const pivotX = coords.chord * 0.25;
  const pivotY = 0;

  const rotatePoint = (p: AirfoilPoint): AirfoilPoint => {
    const dx = p.x - pivotX;
    const dy = p.y - pivotY;
    return {
      x: pivotX + dx * cos - dy * sin,
      y: pivotY + dx * sin + dy * cos,
    };
  };

  return {
    upper: coords.upper.map(rotatePoint),
    lower: coords.lower.map(rotatePoint),
    chord: coords.chord,
  };
}

/**
 * Create SVG path data for the airfoil outline
 * Returns a closed path going around the entire airfoil
 *
 * @param coords - Airfoil coordinates
 * @returns SVG path "d" attribute string
 */
export function createAirfoilPath(coords: AirfoilCoordinates): string {
  if (coords.upper.length === 0) return '';

  // Start from trailing edge, go along upper surface to leading edge,
  // then along lower surface back to trailing edge
  const { upper, lower } = coords;

  // Start at trailing edge (last point of upper surface)
  let path = `M ${upper[upper.length - 1].x} ${upper[upper.length - 1].y}`;

  // Draw upper surface from trailing edge to leading edge (reverse order)
  for (let i = upper.length - 2; i >= 0; i--) {
    path += ` L ${upper[i].x} ${upper[i].y}`;
  }

  // Draw lower surface from leading edge to trailing edge
  for (let i = 0; i < lower.length; i++) {
    path += ` L ${lower[i].x} ${lower[i].y}`;
  }

  path += ' Z'; // Close path

  return path;
}

/**
 * Create SVG path data for the chord line
 *
 * @param coords - Airfoil coordinates
 * @param angleDegrees - Angle of attack in degrees
 * @returns SVG path "d" attribute string
 */
export function createChordLinePath(
  coords: AirfoilCoordinates,
  angleDegrees: number = 0
): string {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Quarter-chord is the rotation center
  const pivotX = coords.chord * 0.25;

  // Leading edge (at origin before rotation)
  const leadingX = pivotX + (0 - pivotX) * cos;
  const leadingY = (0 - pivotX) * sin;

  // Trailing edge
  const trailingX = pivotX + (coords.chord - pivotX) * cos;
  const trailingY = (coords.chord - pivotX) * sin;

  return `M ${leadingX} ${leadingY} L ${trailingX} ${trailingY}`;
}

/**
 * Calculate boundary box for rotated airfoil (useful for centering in view)
 *
 * @param coords - Rotated airfoil coordinates
 * @returns Min/max x and y values
 */
export function getAirfoilBounds(coords: AirfoilCoordinates): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const allPoints = [...coords.upper, ...coords.lower];

  return {
    minX: Math.min(...allPoints.map(p => p.x)),
    maxX: Math.max(...allPoints.map(p => p.x)),
    minY: Math.min(...allPoints.map(p => p.y)),
    maxY: Math.max(...allPoints.map(p => p.y)),
  };
}
