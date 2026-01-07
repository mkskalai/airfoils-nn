import * as tf from '@tensorflow/tfjs';
import type { ModelConfig, TrainingHistory, ActivationFunction } from '../types';

// TensorFlow.js activation identifier type
type TFActivation = 'relu' | 'sigmoid' | 'tanh' | 'linear' | 'softmax' | 'elu' | 'selu' | 'softplus' | 'softsign' | 'hardSigmoid' | 'swish' | 'mish' | 'gelu' | 'gelu_new';

/**
 * Map our activation function names to TensorFlow.js activation functions
 */
function getActivation(activation: ActivationFunction): TFActivation {
  switch (activation) {
    case 'relu':
      return 'relu';
    case 'sigmoid':
      return 'sigmoid';
    case 'tanh':
      return 'tanh';
    case 'leakyRelu':
      return 'relu'; // fallback to relu as leakyReLU needs different handling
    default:
      return 'relu';
  }
}

/**
 * Build a TensorFlow.js Sequential model from configuration
 * @param config - Model configuration
 * @param inputSize - Number of input features (defaults to 5 for backward compatibility)
 */
export function buildModel(config: ModelConfig, inputSize: number = 5): tf.Sequential {
  const model = tf.sequential();

  // Create regularizer if specified
  const regularizer = (config.l1Regularization > 0 || config.l2Regularization > 0)
    ? tf.regularizers.l1l2({
        l1: config.l1Regularization,
        l2: config.l2Regularization,
      })
    : undefined;

  // Add hidden layers
  config.hiddenLayers.forEach((layer, index) => {
    const isLeakyRelu = layer.activation === 'leakyRelu';

    // First layer needs input shape
    if (index === 0) {
      model.add(tf.layers.dense({
        units: layer.neurons,
        activation: isLeakyRelu ? undefined : getActivation(layer.activation),
        kernelRegularizer: regularizer,
        inputShape: [inputSize], // Dynamic input size based on selected features
      }));
    } else {
      model.add(tf.layers.dense({
        units: layer.neurons,
        activation: isLeakyRelu ? undefined : getActivation(layer.activation),
        kernelRegularizer: regularizer,
      }));
    }

    // Add LeakyReLU as separate layer if needed
    if (isLeakyRelu) {
      model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
    }

    // Add dropout after each hidden layer if configured
    const dropoutRate = config.dropoutMode === 'per-layer'
      ? (layer.dropout ?? 0)
      : config.globalDropout;

    if (dropoutRate > 0) {
      model.add(tf.layers.dropout({ rate: dropoutRate }));
    }
  });

  // Output layer (1 neuron, linear activation for regression)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear',
    kernelRegularizer: regularizer,
  }));

  // Compile the model
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: 'meanSquaredError',
    metrics: ['mse'],
  });

  return model;
}

/**
 * Training controller for managing stop/pause
 */
export interface TrainingController {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  isStopped: () => boolean;
}

function createTrainingController(): TrainingController {
  let stopped = false;
  let paused = false;

  return {
    stop: () => { stopped = true; paused = false; },
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    isPaused: () => paused,
    isStopped: () => stopped,
  };
}

/**
 * Callbacks for training progress
 */
export interface TrainingCallbacks {
  onEpochEnd?: (epoch: number, loss: number, valLoss: number) => void;
  onTrainingEnd?: (finalHistory: TrainingHistory[]) => void;
  onTrainingError?: (error: Error) => void;
}

/**
 * Train the model with progress callbacks
 */
export async function trainModel(
  model: tf.Sequential,
  trainX: number[][],
  trainY: number[],
  valX: number[][],
  valY: number[],
  config: ModelConfig,
  callbacks: TrainingCallbacks,
  controller: TrainingController
): Promise<TrainingHistory[]> {
  const history: TrainingHistory[] = [];

  // Convert data to tensors
  const xTrain = tf.tensor2d(trainX);
  const yTrain = tf.tensor2d(trainY, [trainY.length, 1]);
  const xVal = tf.tensor2d(valX);
  const yVal = tf.tensor2d(valY, [valY.length, 1]);

  try {
    for (let epoch = 0; epoch < config.epochs; epoch++) {
      // Check for stop
      if (controller.isStopped()) {
        break;
      }

      // Handle pause
      while (controller.isPaused() && !controller.isStopped()) {
        await tf.nextFrame();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (controller.isStopped()) {
        break;
      }

      // Train for one epoch
      const result = await model.fit(xTrain, yTrain, {
        epochs: 1,
        batchSize: config.batchSize,
        validationData: [xVal, yVal],
        verbose: 0,
      });

      // Extract loss values
      const trainLoss = result.history.loss[0] as number;
      const valLoss = result.history.val_loss[0] as number;

      const entry: TrainingHistory = {
        epoch: epoch + 1,
        loss: trainLoss,
        valLoss: valLoss,
      };

      history.push(entry);

      // Call epoch callback
      if (callbacks.onEpochEnd) {
        callbacks.onEpochEnd(epoch + 1, trainLoss, valLoss);
      }

      // Yield to UI thread
      await tf.nextFrame();
    }

    // Training complete
    if (callbacks.onTrainingEnd) {
      callbacks.onTrainingEnd(history);
    }

    return history;
  } catch (error) {
    if (callbacks.onTrainingError) {
      callbacks.onTrainingError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  } finally {
    // Dispose tensors
    xTrain.dispose();
    yTrain.dispose();
    xVal.dispose();
    yVal.dispose();
  }
}

/**
 * Make predictions with the model
 */
export function predict(
  model: tf.Sequential,
  features: number[][]
): number[] {
  return tf.tidy(() => {
    const input = tf.tensor2d(features);
    const predictions = model.predict(input) as tf.Tensor;
    return Array.from(predictions.dataSync());
  });
}

/**
 * Make a single prediction
 */
export function predictSingle(
  model: tf.Sequential,
  features: number[]
): number {
  return predict(model, [features])[0];
}

/**
 * Get model summary as string
 */
export function getModelSummary(model: tf.Sequential): string {
  let summary = '';
  model.summary(undefined, undefined, (line: string) => {
    summary += line + '\n';
  });
  return summary;
}

/**
 * Get model weights for visualization
 */
export interface LayerWeights {
  weights: number[][];
  biases: number[];
}

export function getModelWeights(model: tf.Sequential): LayerWeights[] {
  const layerWeights: LayerWeights[] = [];

  model.layers.forEach(layer => {
    const weights = layer.getWeights();
    if (weights.length >= 2) {
      const kernelData = weights[0].arraySync() as number[][];
      const biasData = weights[1].arraySync() as number[];
      layerWeights.push({
        weights: kernelData,
        biases: biasData,
      });
    }
  });

  return layerWeights;
}

// Export the controller factory
export { createTrainingController };
