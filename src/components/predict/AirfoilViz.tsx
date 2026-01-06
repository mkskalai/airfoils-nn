import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import {
  generateNACAProfile,
  rotateAirfoil,
  createAirfoilPath,
  createChordLinePath,
  getAirfoilBounds,
} from '../../utils/naca';

interface AirfoilVizProps {
  chordLength: number;      // Chord length in meters
  angleOfAttack: number;    // Angle of attack in degrees
  velocity: number;         // Free-stream velocity in m/s
  width?: number;
  height?: number;
}

export function AirfoilViz({
  chordLength,
  angleOfAttack,
  velocity,
  width = 400,
  height = 300,
}: AirfoilVizProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Generate airfoil geometry
  const { airfoilPath, chordLinePath, bounds, scaledCoords } = useMemo(() => {
    // Generate NACA 0012 profile
    const baseProfile = generateNACAProfile(0.12, 80, chordLength);

    // Rotate by angle of attack
    const rotatedProfile = rotateAirfoil(baseProfile, angleOfAttack);

    // Create paths
    const airfoilPath = createAirfoilPath(rotatedProfile);
    const chordLinePath = createChordLinePath(baseProfile, angleOfAttack);
    const bounds = getAirfoilBounds(rotatedProfile);

    return { airfoilPath, chordLinePath, bounds, scaledCoords: rotatedProfile };
  }, [chordLength, angleOfAttack]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 60, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate scale to fit airfoil with some padding
    const xRange = bounds.maxX - bounds.minX;
    const yRange = bounds.maxY - bounds.minY;

    // Add padding for arrows and labels
    const padding = 0.3;
    const xScale = innerWidth / (xRange * (1 + padding));
    const yScale = innerHeight / (yRange * (1 + padding * 2));
    const scale = Math.min(xScale, yScale);

    // Center point
    const centerX = margin.left + innerWidth / 2;
    const centerY = margin.top + innerHeight / 2;

    // Transform coordinates to SVG space
    const transformX = (x: number) => centerX + (x - (bounds.minX + bounds.maxX) / 2) * scale;
    const transformY = (y: number) => centerY - (y - (bounds.minY + bounds.maxY) / 2) * scale;

    const g = svg.append('g');

    // Draw wind direction arrows (horizontal flow from left)
    const arrowColor = '#64748b';
    const numArrows = 5;
    const arrowStartX = transformX(bounds.minX) - 40;
    const arrowEndX = transformX(bounds.minX) - 10;
    const arrowSpacing = (innerHeight * 0.6) / (numArrows - 1);
    const arrowStartY = centerY - (arrowSpacing * (numArrows - 1)) / 2;

    // Arrow marker definition
    svg.append('defs')
      .append('marker')
      .attr('id', 'wind-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', arrowColor);

    // Draw wind arrows
    for (let i = 0; i < numArrows; i++) {
      g.append('line')
        .attr('x1', arrowStartX)
        .attr('y1', arrowStartY + i * arrowSpacing)
        .attr('x2', arrowEndX)
        .attr('y2', arrowStartY + i * arrowSpacing)
        .attr('stroke', arrowColor)
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#wind-arrow)');
    }

    // Wind label
    g.append('text')
      .attr('x', (arrowStartX + arrowEndX) / 2)
      .attr('y', arrowStartY - 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', arrowColor)
      .attr('font-weight', '500')
      .text(`V = ${velocity.toFixed(1)} m/s`);

    // Draw chord line (dashed)
    const angleRad = (angleOfAttack * Math.PI) / 180;
    const chordStartX = transformX(0);
    const chordStartY = transformY(0);
    const chordEndX = transformX(chordLength * Math.cos(angleRad));
    const chordEndY = transformY(chordLength * Math.sin(angleRad));

    g.append('line')
      .attr('x1', chordStartX)
      .attr('y1', chordStartY)
      .attr('x2', chordEndX)
      .attr('y2', chordEndY)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Draw horizontal reference line for angle measurement
    g.append('line')
      .attr('x1', chordStartX)
      .attr('y1', chordStartY)
      .attr('x2', chordStartX + chordLength * scale * 0.4)
      .attr('y2', chordStartY)
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    // Draw angle arc
    if (Math.abs(angleOfAttack) > 0.5) {
      const arcRadius = chordLength * scale * 0.25;
      const startAngle = 0;
      const endAngle = -angleOfAttack * Math.PI / 180; // Negative because SVG y is inverted

      const arc = d3.arc<void>()
        .innerRadius(arcRadius - 1)
        .outerRadius(arcRadius + 1)
        .startAngle(Math.min(startAngle, endAngle))
        .endAngle(Math.max(startAngle, endAngle));

      g.append('path')
        .attr('d', arc())
        .attr('transform', `translate(${chordStartX}, ${chordStartY})`)
        .attr('fill', '#f97316')
        .attr('opacity', 0.6);

      // Angle label
      const labelAngle = -angleOfAttack * Math.PI / 360; // Half the angle for label position
      const labelRadius = arcRadius + 15;
      g.append('text')
        .attr('x', chordStartX + labelRadius * Math.cos(labelAngle))
        .attr('y', chordStartY + labelRadius * Math.sin(labelAngle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#f97316')
        .attr('font-weight', '600')
        .text(`${angleOfAttack.toFixed(1)}°`);
    }

    // Draw airfoil shape
    const transformedPath = scaledCoords.upper.concat([...scaledCoords.lower].reverse())
      .map((p, i) => {
        const tx = transformX(p.x);
        const ty = transformY(p.y);
        return i === 0 ? `M ${tx} ${ty}` : `L ${tx} ${ty}`;
      })
      .join(' ') + ' Z';

    // Airfoil gradient fill
    const gradientId = 'airfoil-gradient';
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');

    defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%')
      .selectAll('stop')
      .data([
        { offset: '0%', color: '#e0e7ff' },
        { offset: '50%', color: '#c7d2fe' },
        { offset: '100%', color: '#a5b4fc' },
      ])
      .enter()
      .append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);

    g.append('path')
      .attr('d', transformedPath)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 2)
      .attr('opacity', 0.95);

    // Mark leading edge (circle)
    g.append('circle')
      .attr('cx', transformX(scaledCoords.upper[0].x))
      .attr('cy', transformY(scaledCoords.upper[0].y))
      .attr('r', 4)
      .attr('fill', '#4f46e5');

    // Mark trailing edge (smaller circle)
    const trailingEdge = scaledCoords.upper[scaledCoords.upper.length - 1];
    g.append('circle')
      .attr('cx', transformX(trailingEdge.x))
      .attr('cy', transformY(trailingEdge.y))
      .attr('r', 3)
      .attr('fill', '#4f46e5');

    // Chord length annotation
    const chordMidX = (chordStartX + chordEndX) / 2;
    const chordMidY = (chordStartY + chordEndY) / 2;
    const perpAngle = angleRad - Math.PI / 2;
    const labelOffset = 25;

    g.append('text')
      .attr('x', chordMidX + Math.cos(perpAngle) * labelOffset)
      .attr('y', chordMidY - Math.sin(perpAngle) * labelOffset)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280')
      .attr('font-weight', '500')
      .text(`c = ${(chordLength * 1000).toFixed(0)} mm`);

    // Title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px')
      .attr('fill', '#374151')
      .attr('font-weight', '600')
      .text('NACA 0012 Airfoil Profile');

  }, [airfoilPath, chordLinePath, bounds, scaledCoords, chordLength, angleOfAttack, velocity, width, height]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg"
      />
      {/* Legend */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 bg-gray-400" style={{ borderStyle: 'dashed' }}></span>
          <span>Chord line</span>
        </div>
      </div>
    </div>
  );
}
