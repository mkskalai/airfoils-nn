# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based airfoil noise prediction app using neural networks. Users can explore the NASA Airfoil Self-Noise Dataset, train TensorFlow.js models, and make predictions—all in-browser.

## Commands

- `npm run dev` - Start development server
- `npm run build` - Type-check with tsc and build with Vite
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Tech Stack

- React 19 + TypeScript + Vite
- TailwindCSS v4 (with custom theme in `src/index.css`)
- Zustand for state management
- TensorFlow.js for neural network training/inference
- D3.js for visualizations

## Architecture

**Tab-based UI** (`src/App.tsx`):
- **Explore** - Dataset statistics and visualizations (correlation heatmap, distributions, scatterplots)
- **Train** - Neural network configuration, training, and real-time visualizations
- **Predict** - Make predictions with trained model

**State Management** (`src/stores/`):
- `dataStore.ts` - Dataset loading, train/val split
- `modelStore.ts` - Model configuration, training state, history, predictions, training feature selection
- `featureStore.ts` - Feature store with transforms, PCA, derived features for training/visualization

**Types** (`src/types/index.ts` and `src/stores/modelStore.ts`):
- `DataPoint` - 5 input features + 1 target (sound pressure level)
- `ModelConfig` - Layer configuration, hyperparameters, regularization
- `TrainingHistory` - Epoch-by-epoch loss tracking
- `PredictionPoint` - GT vs Predicted pairs + feature values for visualization (original dB scale)

**Data Flow**:
1. Dataset loaded from `/public/airfoil_self_noise.dat` on app mount
2. Feature store initialized with original features
3. User creates transformed/PCA features in Explore → Feature Engineering
4. User selects input features and target for training in Train tab
5. TensorFlow.js model built with dynamic input size based on selected features
6. Training updates `TrainingHistory` and `PredictionPoint[]` in real-time
7. Trained model used for predictions

## Key Components

**Training Tab** (`src/components/train/`):
- `ConfigPanel.tsx` - Feature selection (input/target), architecture, hyperparameters, regularization
- `NetworkPreview.tsx` - Visual preview of network architecture (shown before training)
- `NetworkViz.tsx` - D3.js weight visualization with color/width encoding (shown during/after training)
- `LossChart.tsx` - Real-time training/validation loss chart (D3.js) with log scale toggle
- `PredictionScatterplot.tsx` - GT vs Predicted visualization with R², RMSE (original dB scale)
- `ErrorAnalysis.tsx` - Residual histogram, error metrics (MAE, RMSE, R², within-threshold %)
- `ResidualVsFeature.tsx` - Residual vs feature scatterplots with feature selector (1-5 plots)

**Explore Tab** (`src/components/explore/`):
- `CorrelationHeatmap.tsx` - Dynamic NxN Pearson correlation matrix (updates with feature selection)
- `DistributionChart.tsx` - Histograms with KDE overlay (supports transformed/PCA features)
- `Scatterplot.tsx` - Interactive feature scatterplot (single pair)
- `ScatterplotMatrix.tsx` - Pairwise scatterplot matrix with histograms, correlations, linked brushing
- `FeatureStatsTable.tsx` - Sortable statistics table for all features
- `FeatureEngineering.tsx` - Transform and PCA feature creation UI
- `PCAVisualization.tsx` - Variance explained and loadings charts

**Common Components** (`src/components/common/`):
- `FeatureSelector.tsx` - Multi-select dropdown for dynamic feature selection
- `TabNavigation.tsx` - Tab navigation component

**Predict Tab** (`src/components/predict/`):
- `PredictTab.tsx` - Main prediction interface with state management
- `InputForm.tsx` - Slider+number inputs for 5 features with validation
- `PointSelector.tsx` - Interactive scatterplot for selecting data points
- `AirfoilViz.tsx` - 2D NACA 0012 airfoil visualization (D3.js, shows chord, angle of attack, velocity)

## Theme Colors

Custom TensorFlow Playground-inspired palette defined in `src/index.css`:
- `primary` - Dark blue (#0d47a1)
- `accent` - Light blue (#03a9f4) - training metrics, UI highlights
- `warm` - Orange (#f57c00) - validation metrics
- `deepBlue` - (#1a237e) - negative values, cold
- `deepOrange` - (#e65100) - positive values, warm

## Performance Considerations

### Zustand Store Subscriptions

**Critical**: Always use selective Zustand subscriptions to avoid re-renders during training:

```tsx
// ❌ Bad - re-renders on ANY store change (causes training slowdown)
const { config, trainingStatus } = useModelStore();

// ✅ Good - only re-renders when specific values change
const config = useModelStore(state => state.config);
const trainingStatus = useModelStore(state => state.trainingStatus);
```

This pattern is essential in components that render during training (TrainTab, ConfigPanel, NetworkPreview, etc.) because the model store updates on every epoch.

### CSS Animations During Training

Avoid CSS animations (`animate-spin`, `animate-pulse`, etc.) in components visible during training. These cause continuous browser repaints that block the training loop.

### D3 Visualization Updates

For expensive D3 visualizations like `NetworkViz.tsx`:
1. Use `IntersectionObserver` to skip updates when off-screen
2. Throttle updates (250ms minimum) during training
3. Disable pointer events during training
4. Use `requestIdleCallback` for non-critical updates

### Files with Performance-Critical Code

- `src/components/train/TrainTab.tsx` - Uses selective subscriptions
- `src/components/train/ConfigPanel.tsx` - Uses selective subscriptions
- `src/components/train/NetworkViz.tsx` - Throttled updates, visibility detection
- `src/components/tutorial/TutorialOverlay.tsx` - Static icons (no animations) during training
- `src/hooks/useTraining.ts` - Uses selective subscriptions

## Implementation Status

See `PLAN.md` for detailed work packages. Current status:
- ✅ WP1-6: Setup, Data Layer, Explore Tab, Config UI, Training, Loss Chart
- ✅ WP6.5: GT vs Predicted Scatterplots (with denormalized values)
- ✅ WP7: Error Analysis (residual histogram, error metrics, diagnostics)
- ✅ WP8: Network Architecture Visualization (weight visualization with D3.js)
- ✅ WP9: Prediction Interface (input form, point selector, history, nearest neighbors)
- ✅ WP10: 2D Airfoil Visualization (NACA 0012 profile with angle of attack and velocity)
- ✅ WP11: Polish (error handling, responsive design, model validation, animations)
- ✅ WP-FE: Feature Engineering (see PLAN_FEATURE_ENGINEERING.md)
  - ✅ WP-FE1: Feature Store Foundation
  - ✅ WP-FE2: PCA Implementation
  - ✅ WP-FE3: Feature Engineering UI
  - ✅ WP-FE4: PCA Visualizations
  - ✅ WP-FE5: Dynamic Feature Selection for Plots
  - ✅ WP-FE6: Pairwise Scatterplot Matrix
  - ✅ WP-FE7: Training Tab Feature Selection (input/target from feature store, dynamic model size, error analysis feature selector)
  - ✅ WP-FE8: Loss Chart Log Scale Toggle
  - ✅ WP-FE9: Plot Download Functionality (PNG, SVG, CSV export for all charts)
