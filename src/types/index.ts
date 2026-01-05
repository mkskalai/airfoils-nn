export interface DataPoint {
  frequency: number;
  angleOfAttack: number;
  chordLength: number;
  freeStreamVelocity: number;
  suctionSideDisplacementThickness: number;
  soundPressureLevel: number;
}

export interface ColumnStats {
  min: number;
  max: number;
  mean: number;
  std: number;
}

export interface DatasetStats {
  frequency: ColumnStats;
  angleOfAttack: ColumnStats;
  chordLength: ColumnStats;
  freeStreamVelocity: ColumnStats;
  suctionSideDisplacementThickness: ColumnStats;
  soundPressureLevel: ColumnStats;
}

export interface Dataset {
  raw: DataPoint[];
  normalized: DataPoint[];
  stats: DatasetStats;
}

export type NormalizationType = 'none' | 'minmax' | 'zscore' | 'custom';

export type NormalizationMode = 'global' | 'per-feature';

export interface FeatureNormalization {
  type: NormalizationType;
  customTransform?: string; // e.g., "log(x+1)", "sqrt(x)", "(x-min)/(max-min)"
}

export interface NormalizationConfig {
  mode: NormalizationMode;
  global: FeatureNormalization;
  perFeature: Record<keyof Omit<DataPoint, 'soundPressureLevel'>, FeatureNormalization>;
  targetNormalization: FeatureNormalization;
}

export type ActivationFunction = 'relu' | 'sigmoid' | 'tanh' | 'leakyRelu';

export type DropoutMode = 'global' | 'per-layer';

export interface LayerConfig {
  neurons: number;
  activation: ActivationFunction;
  dropout?: number; // per-layer dropout (used when dropoutMode is 'per-layer')
}

export interface ModelConfig {
  hiddenLayers: LayerConfig[];
  learningRate: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
  l1Regularization: number;
  l2Regularization: number;
  dropoutMode: DropoutMode;
  globalDropout: number; // used when dropoutMode is 'global'
}

export type TrainingStatus = 'idle' | 'training' | 'paused' | 'complete' | 'error';

export interface TrainingHistory {
  epoch: number;
  loss: number;
  valLoss: number;
}

export type TabId = 'explore' | 'train' | 'predict';

export const FEATURE_NAMES: (keyof Omit<DataPoint, 'soundPressureLevel'>)[] = [
  'frequency',
  'angleOfAttack',
  'chordLength',
  'freeStreamVelocity',
  'suctionSideDisplacementThickness',
];

export const FEATURE_LABELS: Record<keyof DataPoint, string> = {
  frequency: 'Frequency (Hz)',
  angleOfAttack: 'Angle of Attack (deg)',
  chordLength: 'Chord Length (m)',
  freeStreamVelocity: 'Free-stream Velocity (m/s)',
  suctionSideDisplacementThickness: 'Suction Side Displacement Thickness (m)',
  soundPressureLevel: 'Sound Pressure Level (dB)',
};
