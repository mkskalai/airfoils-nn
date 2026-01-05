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
- D3 for visualizations (planned)

## Architecture

**Tab-based UI** (`src/App.tsx`):
- **Explore** - Dataset statistics and visualizations
- **Train** - Neural network configuration and training
- **Predict** - Make predictions with trained model

**State Management** (`src/stores/`):
- `dataStore.ts` - Dataset loading, normalization (min-max/z-score), and statistics
- `modelStore.ts` - Model configuration, training state, history tracking

**Types** (`src/types/index.ts`):
- `DataPoint` - 5 input features + 1 target (sound pressure level)
- `ModelConfig` - Layer configuration, hyperparameters
- `TrainingHistory` - Epoch-by-epoch loss tracking

**Data Flow**:
1. Dataset loaded from `/public/airfoil_self_noise.dat` on app mount
2. Data normalized based on user-selected method
3. TensorFlow.js model built from `ModelConfig`
4. Training updates `TrainingHistory` in real-time
5. Trained model used for predictions

## Theme Colors

Custom TensorFlow Playground-inspired palette defined in `src/index.css`:
- `primary` - Dark blue (#0d47a1)
- `accent` - Light blue (#03a9f4)
- `warm` - Orange (#f57c00)
