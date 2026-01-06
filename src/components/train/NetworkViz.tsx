import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useModelStore } from '../../stores/modelStore';
import { FEATURE_LABELS, FEATURE_NAMES } from '../../types';
import { THEME_COLORS, formatValue } from '../../utils/colors';

// Throttle updates to prevent freezing during training
const THROTTLE_MS = 250; // Increased from 100ms for better performance

interface Node {
  id: string;
  x: number;
  y: number;
  layerIndex: number;
  nodeIndex: number;
  label?: string;
}

interface Connection {
  id: string;
  source: Node;
  target: Node;
  weight: number;
  layerIndex: number;
  sourceIndex: number;
  targetIndex: number;
}

interface TooltipData {
  x: number;
  y: number;
  weight: number;
  from: string;
  to: string;
}

// Neuron size - larger like TensorFlow Playground
const NODE_RADIUS = 24;
const NODE_GAP = 20;
const LAYER_GAP = 160;
const PADDING = { top: 50, right: 60, bottom: 50, left: 60 };

export function NetworkViz() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use selective subscriptions to prevent re-renders on unrelated store changes
  const config = useModelStore((state) => state.config);
  const networkWeights = useModelStore((state) => state.networkWeights);
  const trainingStatus = useModelStore((state) => state.trainingStatus);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Track if we've initialized the SVG
  const initializedRef = useRef(false);

  // Track visibility to skip updates when scrolled out of view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 } // Trigger when at least 10% visible
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Throttle weight updates to prevent freezing during training
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [throttledWeights, setThrottledWeights] = useState(networkWeights);

  useEffect(() => {
    // Skip updates when not visible during training
    if (!isVisible && trainingStatus === 'training') {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= THROTTLE_MS) {
      // Enough time has passed, update immediately
      lastUpdateRef.current = now;
      setThrottledWeights(networkWeights);
    } else {
      // Schedule a delayed update using setTimeout instead of rAF
      // setTimeout is more reliable for throttling as it doesn't depend on paint timing
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
      const delay = THROTTLE_MS - timeSinceLastUpdate;
      pendingUpdateRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setThrottledWeights(networkWeights);
        pendingUpdateRef.current = null;
      }, delay);
    }

    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
    };
  }, [networkWeights, isVisible, trainingStatus]);

  // Build layer structure
  const layerSizes = useMemo(() => [
    5, // Input layer
    ...config.hiddenLayers.map((l) => l.neurons),
    1, // Output layer
  ], [config.hiddenLayers]);

  // Compute layout dimensions - larger like TensorFlow Playground
  const { width, height, nodes } = useMemo(() => {
    const maxNodes = Math.max(...layerSizes);
    const calculatedHeight = Math.max(400, maxNodes * (NODE_RADIUS * 2 + NODE_GAP) + PADDING.top + PADDING.bottom);
    const calculatedWidth = layerSizes.length * LAYER_GAP + PADDING.left + PADDING.right;

    // Create nodes
    const nodes: Node[] = [];
    layerSizes.forEach((nodeCount, layerIndex) => {
      const x = PADDING.left + layerIndex * LAYER_GAP;
      const layerHeight = nodeCount * (NODE_RADIUS * 2 + NODE_GAP) - NODE_GAP;
      const startY = (calculatedHeight - layerHeight) / 2;

      // Limit displayed nodes for large layers
      const displayCount = Math.min(nodeCount, 8);
      const hasMore = nodeCount > 8;

      for (let i = 0; i < displayCount; i++) {
        let label: string | undefined;

        // Handle "..." indicator for large layers
        if (hasMore && i === displayCount - 1) {
          label = `+${nodeCount - displayCount + 1}`;
        } else if (layerIndex === 0) {
          // Abbreviate feature names for input layer
          label = FEATURE_LABELS[FEATURE_NAMES[i]].split(' ')[0].substring(0, 3);
        } else if (layerIndex === layerSizes.length - 1) {
          label = 'SPL';
        }

        nodes.push({
          id: `${layerIndex}-${i}`,
          x,
          y: startY + i * (NODE_RADIUS * 2 + NODE_GAP) + NODE_RADIUS,
          layerIndex,
          nodeIndex: i,
          label,
        });
      }
    });

    return { width: calculatedWidth, height: calculatedHeight, nodes };
  }, [layerSizes]);

  // Build connections with weights (limit for visual clarity)
  const connections = useMemo(() => {
    const conns: Connection[] = [];
    const maxConnectionsPerLayer = 50;

    for (let l = 0; l < layerSizes.length - 1; l++) {
      const layerNodes = nodes.filter(n => n.layerIndex === l);
      const nextLayerNodes = nodes.filter(n => n.layerIndex === l + 1);
      let connectionCount = 0;

      for (let i = 0; i < layerNodes.length && connectionCount < maxConnectionsPerLayer; i++) {
        for (let j = 0; j < nextLayerNodes.length && connectionCount < maxConnectionsPerLayer; j++) {
          let weight = 0;
          if (throttledWeights && throttledWeights[l]) {
            const layerWeights = throttledWeights[l].weights;
            if (layerWeights[i] && layerWeights[i][j] !== undefined) {
              weight = layerWeights[i][j];
            }
          }

          conns.push({
            id: `conn-${l}-${i}-${j}`,
            source: layerNodes[i],
            target: nextLayerNodes[j],
            weight,
            layerIndex: l,
            sourceIndex: i,
            targetIndex: j,
          });
          connectionCount++;
        }
      }
    }

    return conns;
  }, [nodes, layerSizes, throttledWeights]);

  // Compute max absolute weight for normalization
  const maxAbsWeight = useMemo(() => {
    if (!throttledWeights) return 1;
    let max = 0;
    for (const layer of throttledWeights) {
      for (const row of layer.weights) {
        for (const w of row) {
          max = Math.max(max, Math.abs(w));
        }
      }
    }
    return max || 1;
  }, [throttledWeights]);

  // Initialize SVG structure (only once)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create layer groups for proper z-ordering
    svg.append('g').attr('class', 'connections');
    svg.append('g').attr('class', 'nodes');
    svg.append('g').attr('class', 'labels');

    initializedRef.current = true;
  }, [layerSizes]); // Re-initialize when layer structure changes

  // Track pending idle callback for cleanup
  const idleCallbackRef = useRef<number | null>(null);

  // Update connections (separate from node updates for performance)
  useEffect(() => {
    if (!svgRef.current || !initializedRef.current) return;

    const doUpdate = () => {
      if (!svgRef.current) return;

      const svg = d3.select(svgRef.current);
      const connectionsGroup = svg.select('g.connections');

      // Use data join for efficient updates
      const lines = connectionsGroup.selectAll<SVGLineElement, Connection>('line')
        .data(connections, d => d.id);

      // Enter new connections
      lines.enter()
        .append('line')
        .attr('x1', d => d.source.x + NODE_RADIUS)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x - NODE_RADIUS)
        .attr('y2', d => d.target.y)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 2)
        .attr('opacity', 0.6)
        .attr('stroke-linecap', 'round')
        .style('cursor', 'pointer')
        .on('mouseenter', function(_event, d) {
          // Skip hover effects during training to prevent render loops
          if (trainingStatus === 'training') return;

          d3.select(this)
            .attr('stroke-width', 8)
            .attr('opacity', 1);

          const fromLabel = d.source.layerIndex === 0
            ? FEATURE_LABELS[FEATURE_NAMES[d.sourceIndex]].split(' ')[0]
            : `H${d.source.layerIndex}[${d.sourceIndex}]`;
          const toLabel = d.target.layerIndex === layerSizes.length - 1
            ? 'Output'
            : `H${d.target.layerIndex}[${d.targetIndex}]`;

          setTooltip({
            x: (d.source.x + d.target.x) / 2,
            y: (d.source.y + d.target.y) / 2,
            weight: d.weight,
            from: fromLabel,
            to: toLabel,
          });
        })
        .on('mouseleave', function() {
          if (trainingStatus === 'training') return;
          setTooltip(null);
        });

      // Update existing + new connections
      connectionsGroup.selectAll<SVGLineElement, Connection>('line')
        .attr('x1', d => d.source.x + NODE_RADIUS)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x - NODE_RADIUS)
        .attr('y2', d => d.target.y)
        .attr('stroke', d => {
          if (!throttledWeights) return '#e0e0e0';
          return d.weight >= 0 ? THEME_COLORS.deepOrange : THEME_COLORS.deepBlue;
        })
        .attr('stroke-width', d => {
          if (!throttledWeights) return 2;
          const normalized = Math.abs(d.weight) / maxAbsWeight;
          return 1 + normalized * 6;
        })
        .attr('opacity', d => {
          if (!throttledWeights) return 0.6;
          const normalized = Math.abs(d.weight) / maxAbsWeight;
          return 0.4 + normalized * 0.5;
        });

      // Exit old connections
      lines.exit().remove();
    };

    // During training, use requestIdleCallback to defer updates
    if (trainingStatus === 'training' && 'requestIdleCallback' in window) {
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
      }
      idleCallbackRef.current = requestIdleCallback(doUpdate, { timeout: 500 });
    } else {
      doUpdate();
    }

    return () => {
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
        idleCallbackRef.current = null;
      }
    };
  }, [connections, throttledWeights, maxAbsWeight, layerSizes, trainingStatus]);

  // Track pending idle callback for nodes
  const nodesIdleCallbackRef = useRef<number | null>(null);

  // Update nodes separately - using circles like NetworkPreview
  useEffect(() => {
    if (!svgRef.current || !initializedRef.current) return;

    const doUpdate = () => {
      if (!svgRef.current) return;

      const svg = d3.select(svgRef.current);
      const nodesGroup = svg.select('g.nodes');
      const labelsGroup = svg.select('g.labels');

      // --- NODES ---
      const nodeGroups = nodesGroup.selectAll<SVGGElement, Node>('g.node')
        .data(nodes, d => d.id);

      // Enter new nodes
      const nodeEnter = nodeGroups.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x}, ${d.y})`)
        .style('cursor', 'pointer');

      // Circle node - larger like TensorFlow Playground
      nodeEnter.append('circle')
        .attr('class', 'node-circle')
        .attr('r', NODE_RADIUS)
        .attr('stroke', 'white')
        .attr('stroke-width', 3)
        .attr('class', 'drop-shadow-sm');

      // Label inside node
      nodeEnter.append('text')
        .attr('class', 'node-label')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', 'bold')
        .attr('fill', 'white');

      // Update all nodes
      const nodeUpdate = nodesGroup.selectAll<SVGGElement, Node>('g.node')
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

      // Update node circles based on layer type
      nodeUpdate.select('circle')
        .attr('fill', d => {
          if (d.layerIndex === 0) return THEME_COLORS.accent; // Input: blue
          if (d.layerIndex === layerSizes.length - 1) return THEME_COLORS.warm; // Output: orange
          return THEME_COLORS.primary; // Hidden: dark blue
        });

      // Update labels
      nodeUpdate.select('text.node-label')
        .text(d => {
          if (d.label) {
            return d.label.startsWith('+') ? d.label : d.label.substring(0, 4);
          }
          return '';
        })
        .attr('font-size', d => d.label?.startsWith('+') ? 10 : 11);

      // Add hover handlers (disabled during training to prevent render loops)
      nodeUpdate
        .on('mouseenter', function(_event, d) {
          // Skip hover effects during training
          if (trainingStatus === 'training') return;

          setHoveredNode(d);

          // Highlight this node
          d3.select(this).select('circle')
            .attr('stroke', THEME_COLORS.primary)
            .attr('stroke-width', 4);

          // Highlight connected edges
          svg.select('g.connections').selectAll<SVGLineElement, Connection>('line')
            .attr('opacity', conn => {
              if (conn.source.id === d.id || conn.target.id === d.id) {
                return 1;
              }
              return 0.1;
            })
            .attr('stroke-width', conn => {
              if (conn.source.id === d.id || conn.target.id === d.id) {
                if (!throttledWeights) return 4;
                const normalized = Math.abs(conn.weight) / maxAbsWeight;
                return 3 + normalized * 7;
              }
              if (!throttledWeights) return 2;
              const normalized = Math.abs(conn.weight) / maxAbsWeight;
              return 1 + normalized * 6;
            });
        })
        .on('mouseleave', function() {
          // Skip hover effects during training
          if (trainingStatus === 'training') return;

          setHoveredNode(null);

          // Reset node
          d3.select(this).select('circle')
            .attr('stroke', 'white')
            .attr('stroke-width', 3);

          // Reset edges
          svg.select('g.connections').selectAll<SVGLineElement, Connection>('line')
            .attr('opacity', conn => {
              if (!throttledWeights) return 0.6;
              const normalized = Math.abs(conn.weight) / maxAbsWeight;
              return 0.4 + normalized * 0.5;
            })
            .attr('stroke-width', conn => {
              if (!throttledWeights) return 2;
              const normalized = Math.abs(conn.weight) / maxAbsWeight;
              return 1 + normalized * 6;
            });
        });

      // Exit old nodes
      nodeGroups.exit().remove();

      // --- LABELS ---
      labelsGroup.selectAll('*').remove();

      // Layer labels at bottom (matching NetworkPreview style)
      layerSizes.forEach((_size, layerIndex) => {
        const layerX = PADDING.left + layerIndex * LAYER_GAP;

        let labelText = '';
        if (layerIndex === 0) {
          labelText = 'Input';
        } else if (layerIndex === layerSizes.length - 1) {
          labelText = 'Output';
        } else {
          labelText = `Hidden ${layerIndex}`;
        }

        // Layer name at bottom
        labelsGroup.append('text')
          .attr('x', layerX)
          .attr('y', height - 15)
          .attr('text-anchor', 'middle')
          .attr('font-size', 13)
          .attr('font-weight', 500)
          .attr('fill', '#757575')
          .text(labelText);

        // Activation function at top (for hidden and output layers)
        if (layerIndex > 0) {
          const activation = layerIndex === layerSizes.length - 1
            ? 'linear'
            : config.hiddenLayers[layerIndex - 1]?.activation || '';

          labelsGroup.append('text')
            .attr('x', layerX)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('fill', '#9e9e9e')
            .text(activation);
        }
      });
    };

    // During training, use requestIdleCallback to defer updates
    if (trainingStatus === 'training' && 'requestIdleCallback' in window) {
      if (nodesIdleCallbackRef.current) {
        cancelIdleCallback(nodesIdleCallbackRef.current);
      }
      nodesIdleCallbackRef.current = requestIdleCallback(doUpdate, { timeout: 500 });
    } else {
      doUpdate();
    }

    return () => {
      if (nodesIdleCallbackRef.current) {
        cancelIdleCallback(nodesIdleCallbackRef.current);
        nodesIdleCallbackRef.current = null;
      }
    };
  }, [nodes, throttledWeights, maxAbsWeight, layerSizes, config.hiddenLayers, height, trainingStatus]);

  const isTraining = trainingStatus === 'training';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        Network Architecture
        {isTraining && (
          <span className="ml-2 text-sm font-normal text-accent">
            • Training...
          </span>
        )}
      </h3>

      <div ref={containerRef} className="overflow-x-auto relative">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="mx-auto"
          style={{
            minWidth: width,
            // Disable pointer events during training to prevent hover-induced render loops
            pointerEvents: isTraining ? 'none' : 'auto',
          }}
        />

        {/* Tooltip for connections */}
        {tooltip && throttledWeights && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm z-10 transform -translate-x-1/2 -translate-y-full"
            style={{
              left: tooltip.x,
              top: tooltip.y - 10,
            }}
          >
            <div className="font-medium">{tooltip.from} → {tooltip.to}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-300">Weight:</span>
              <span className={`font-mono font-bold ${tooltip.weight >= 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                {formatValue(tooltip.weight, 4)}
              </span>
            </div>
          </div>
        )}

        {/* Node hover info */}
        {hoveredNode && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm z-10 transform -translate-x-1/2"
            style={{
              left: hoveredNode.x,
              top: hoveredNode.y + NODE_RADIUS + 10,
            }}
          >
            {hoveredNode.layerIndex === 0 ? (
              <span>{FEATURE_LABELS[FEATURE_NAMES[hoveredNode.nodeIndex]]}</span>
            ) : hoveredNode.layerIndex === layerSizes.length - 1 ? (
              <span>Output: Sound Pressure Level (dB)</span>
            ) : (
              <div>
                <div>Hidden Layer {hoveredNode.layerIndex}, Neuron {hoveredNode.nodeIndex + 1}</div>
                {throttledWeights && (
                  <div className="text-gray-400 text-xs mt-1">
                    Bias: {formatValue(throttledWeights[hoveredNode.layerIndex - 1]?.biases[hoveredNode.nodeIndex] || 0, 3)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: THEME_COLORS.deepOrange }} />
          <span className="text-gray-600">Positive weight</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: THEME_COLORS.deepBlue }} />
          <span className="text-gray-600">Negative weight</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="60" height="12">
            <line x1="0" y1="6" x2="20" y2="6" stroke="#999" strokeWidth="1" />
            <line x1="30" y1="6" x2="60" y2="6" stroke="#666" strokeWidth="4" />
          </svg>
          <span className="text-gray-600">Line thickness = weight magnitude</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-3 text-center text-xs text-gray-400">
        Hover over neurons or connections to see details
      </div>
    </div>
  );
}
