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
- `dataStore.ts` - Dataset loading, normalization (none/min-max/z-score/custom), train/val split
- `modelStore.ts` - Model configuration, training state, history, predictions

**Types** (`src/types/index.ts` and `src/stores/modelStore.ts`):
- `DataPoint` - 5 input features + 1 target (sound pressure level)
- `ModelConfig` - Layer configuration, hyperparameters, regularization
- `TrainingHistory` - Epoch-by-epoch loss tracking
- `PredictionPoint` - GT vs Predicted pairs + feature values for visualization (original dB scale)

**Data Flow**:
1. Dataset loaded from `/public/airfoil_self_noise.dat` on app mount
2. Data normalized based on user-selected method (global or per-feature)
3. TensorFlow.js model built from `ModelConfig`
4. Training updates `TrainingHistory` and `PredictionPoint[]` in real-time
5. Trained model used for predictions

## Key Components

**Training Tab** (`src/components/train/`):
- `ConfigPanel.tsx` - Normalization, architecture, hyperparameters, regularization
- `NetworkPreview.tsx` - Visual preview of network architecture (shown before training)
- `NetworkViz.tsx` - D3.js weight visualization with color/width encoding (shown during/after training)
- `LossChart.tsx` - Real-time training/validation loss chart (D3.js)
- `PredictionScatterplot.tsx` - GT vs Predicted visualization with R², RMSE (original dB scale)
- `ErrorAnalysis.tsx` - Residual histogram, error metrics (MAE, RMSE, R², within-threshold %)
- `ResidualVsFeature.tsx` - Residual vs feature scatterplots (5 plots, one per input feature)

**Explore Tab** (`src/components/explore/`):
- `CorrelationHeatmap.tsx` - 6x6 Pearson correlation matrix
- `DistributionChart.tsx` - Histograms with KDE overlay
- `Scatterplot.tsx` - Interactive feature scatterplot

**Predict Tab** (`src/components/predict/`):
- `PredictTab.tsx` - Main prediction interface with state management
- `InputForm.tsx` - Slider+number inputs for 5 features with validation
- `PointSelector.tsx` - Interactive scatterplot for selecting data points

## Theme Colors

Custom TensorFlow Playground-inspired palette defined in `src/index.css`:
- `primary` - Dark blue (#0d47a1)
- `accent` - Light blue (#03a9f4) - training metrics, UI highlights
- `warm` - Orange (#f57c00) - validation metrics
- `deepBlue` - (#1a237e) - negative values, cold
- `deepOrange` - (#e65100) - positive values, warm

## Implementation Status

See `PLAN.md` for detailed work packages. Current status:
- ✅ WP1-6: Setup, Data Layer, Explore Tab, Config UI, Training, Loss Chart
- ✅ WP6.5: GT vs Predicted Scatterplots (with denormalized values)
- ✅ WP7: Error Analysis (residual histogram, error metrics, diagnostics)
- ✅ WP8: Network Architecture Visualization (weight visualization with D3.js)
- ✅ WP9: Prediction Interface (input form, point selector, history, nearest neighbors)
- 🔲 WP10-11: Airfoil Viz, Polish
- 🔲 WP12: PCA Analysis (Explore)
