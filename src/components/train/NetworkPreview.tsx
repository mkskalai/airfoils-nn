import { useMemo } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { useFeatureStore } from '../../stores/featureStore';

interface Node {
  x: number;
  y: number;
  label?: string;
  fullName?: string; // Full name for tooltip
}

interface Layer {
  nodes: Node[];
  label: string;
  activation?: string;
}

export function NetworkPreview() {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const config = useModelStore(state => state.config);
  const trainingInputFeatureIds = useModelStore(state => state.trainingInputFeatureIds);
  const trainingTargetFeatureId = useModelStore(state => state.trainingTargetFeatureId);
  const { getFeature } = useFeatureStore();

  // Get feature definitions for selected inputs and target
  const inputFeatures = useMemo(() => {
    return trainingInputFeatureIds
      .map(id => getFeature(id))
      .filter((f): f is NonNullable<typeof f> => f !== undefined);
  }, [trainingInputFeatureIds, getFeature]);

  const targetFeature = useMemo(() => {
    return getFeature(trainingTargetFeatureId);
  }, [trainingTargetFeatureId, getFeature]);

  const { layers, connections, width, height, inputCount } = useMemo(() => {
    // Match NetworkViz dimensions
    const padding = { top: 50, right: 60, bottom: 50, left: 60 };
    const nodeRadius = 24;
    const layerGap = 160;
    const nodeGap = 20;

    const numInputs = inputFeatures.length || 1;

    // Build layer structure
    const layerSizes = [
      numInputs, // Input layer (dynamic based on selected features)
      ...config.hiddenLayers.map((l) => l.neurons),
      1, // Output layer
    ];

    const maxNodes = Math.max(...layerSizes);
    const calculatedHeight = Math.max(400, maxNodes * (nodeRadius * 2 + nodeGap) + padding.top + padding.bottom);
    const calculatedWidth = layerSizes.length * layerGap + padding.left + padding.right;

    const layers: Layer[] = [];

    // Create layers
    layerSizes.forEach((nodeCount, layerIndex) => {
      const x = padding.left + layerIndex * layerGap;
      const layerHeight = nodeCount * (nodeRadius * 2 + nodeGap) - nodeGap;
      const startY = (calculatedHeight - layerHeight) / 2;

      const nodes: Node[] = [];
      const displayCount = Math.min(nodeCount, 8); // Limit displayed nodes
      const hasMore = nodeCount > 8;

      for (let i = 0; i < displayCount; i++) {
        let label: string | undefined;
        let fullName: string | undefined;

        // Add labels for input and output layers
        if (layerIndex === 0 && inputFeatures[i]) {
          const feature = inputFeatures[i];
          // Use abbreviated label (first word or first 4 chars)
          const words = feature.name.split(/[\s(]/);
          label = words[0].length <= 6 ? words[0] : words[0].substring(0, 4);
          fullName = feature.name;
        } else if (layerIndex === layerSizes.length - 1) {
          // Use abbreviated target name
          if (targetFeature) {
            const words = targetFeature.name.split(/[\s(]/);
            label = words[0].length <= 6 ? words[0] : words[0].substring(0, 4);
            fullName = targetFeature.name;
          } else {
            label = 'Target';
            fullName = 'Target Variable';
          }
        }

        // Handle "..." indicator for large layers
        if (hasMore && i === displayCount - 1) {
          nodes.push({
            x,
            y: startY + i * (nodeRadius * 2 + nodeGap) + nodeRadius,
            label: `+${nodeCount - displayCount + 1}`,
            fullName: `${nodeCount - displayCount + 1} more nodes`,
          });
        } else {
          nodes.push({
            x,
            y: startY + i * (nodeRadius * 2 + nodeGap) + nodeRadius,
            label,
            fullName,
          });
        }
      }

      let layerLabel = '';
      let activation: string | undefined;
      if (layerIndex === 0) {
        layerLabel = 'Input';
      } else if (layerIndex === layerSizes.length - 1) {
        layerLabel = 'Output';
        activation = 'linear';
      } else {
        layerLabel = `Hidden ${layerIndex}`;
        activation = config.hiddenLayers[layerIndex - 1]?.activation;
      }

      layers.push({ nodes, label: layerLabel, activation });
    });

    // Create connections (only between adjacent layers)
    const connections: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let l = 0; l < layers.length - 1; l++) {
      const layer1 = layers[l];
      const layer2 = layers[l + 1];

      // Limit connections for visual clarity
      const maxConnections = 50;
      let connectionCount = 0;

      for (const n1 of layer1.nodes) {
        for (const n2 of layer2.nodes) {
          if (connectionCount < maxConnections) {
            connections.push({
              x1: n1.x + nodeRadius,
              y1: n1.y,
              x2: n2.x - nodeRadius,
              y2: n2.y,
            });
            connectionCount++;
          }
        }
      }
    }

    return { layers, connections, width: calculatedWidth, height: calculatedHeight, inputCount: numInputs };
  }, [config.hiddenLayers, inputFeatures, targetFeature]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        Network Architecture Preview
      </h3>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          className="mx-auto"
          style={{ minWidth: width }}
        >
          {/* Connections */}
          <g className="connections">
            {connections.map((conn, i) => (
              <line
                key={i}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke="#e0e0e0"
                strokeWidth={2}
                opacity={0.6}
              />
            ))}
          </g>

          {/* Nodes */}
          {layers.map((layer, layerIndex) => (
            <g key={layerIndex} className="layer">
              {layer.nodes.map((node, nodeIndex) => (
                <g key={nodeIndex} className="cursor-pointer">
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={24}
                    fill={
                      layerIndex === 0
                        ? '#03a9f4' // Input: accent
                        : layerIndex === layers.length - 1
                        ? '#f57c00' // Output: warm
                        : '#0d47a1' // Hidden: primary
                    }
                    stroke="white"
                    strokeWidth={3}
                    className="drop-shadow-sm"
                  >
                    {node.fullName && <title>{node.fullName}</title>}
                  </circle>
                  {node.label && (
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={node.label.startsWith('+') ? 10 : 11}
                      fill="white"
                      fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.label.startsWith('+') ? node.label : node.label.substring(0, 6)}
                    </text>
                  )}
                </g>
              ))}

              {/* Layer label */}
              <text
                x={layer.nodes[0]?.x ?? 0}
                y={height - 15}
                textAnchor="middle"
                fontSize={13}
                fill="#757575"
                fontWeight="500"
              >
                {layer.label}
              </text>

              {/* Activation label */}
              {layer.activation && (
                <text
                  x={layer.nodes[0]?.x ?? 0}
                  y={25}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#9e9e9e"
                >
                  {layer.activation}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Architecture summary */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <span
          className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium cursor-help"
          title={inputFeatures.map(f => f.name).join(', ')}
        >
          {inputCount} input{inputCount !== 1 ? 's' : ''}
        </span>
        {config.hiddenLayers.map((layer, i) => (
          <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
            {layer.neurons} ({layer.activation})
          </span>
        ))}
        <span
          className="px-3 py-1 bg-warm/10 text-warm rounded-full text-sm font-medium cursor-help"
          title={targetFeature?.name || 'Target'}
        >
          1 output
        </span>
      </div>

      {/* Total parameters estimate */}
      <div className="mt-3 text-center text-sm text-gray-500">
        ~{estimateParameters(inputCount, config.hiddenLayers.map((l) => l.neurons)).toLocaleString()} trainable parameters
      </div>
    </div>
  );
}

function estimateParameters(inputSize: number, hiddenSizes: number[]): number {
  const layers = [inputSize, ...hiddenSizes, 1];
  let params = 0;
  for (let i = 0; i < layers.length - 1; i++) {
    // weights + biases
    params += layers[i] * layers[i + 1] + layers[i + 1];
  }
  return params;
}
