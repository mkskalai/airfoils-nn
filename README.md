# Airfoil Noise Prediction

**Live App**: [https://mkskalai.github.io/airfoils-nn/](https://mkskalai.github.io/airfoils-nn/)

An interactive browser-based application for exploring, training, and deploying neural networks to predict airfoil self-noise. Built entirely with TensorFlow.js, all machine learning happens in your browser—no server required.

## Who Is This For?

- **Students & Educators** - Learn neural network concepts through interactive experimentation
- **ML Enthusiasts** - Explore feature engineering, PCA, and model architecture without setup
- **Engineers & Researchers** - Quickly prototype and test different model configurations for airfoil noise prediction

## What's Available

### Explore Tab
- **Dataset Statistics** - Interactive feature statistics table with sorting
- **Correlation Analysis** - Dynamic heatmap showing Pearson correlations between features
- **Distributions** - Histograms with KDE overlays for all features
- **Scatterplots** - Single pair and pairwise scatterplot matrix with linked brushing
- **Feature Engineering** - Create transformed features (log, square, sqrt, reciprocal) and PCA components
- **PCA Visualization** - Variance explained and feature loadings charts
- **Export Data** - Download plots as PNG, SVG, or CSV

### Train Tab
- **Feature Selection** - Choose input features and target from original or engineered features
- **Architecture Design** - Configure layers, neurons, activation functions, and regularization
- **Network Preview** - Visual representation of your network architecture
- **Real-time Training** - Live loss charts (with log scale option) and weight visualization
- **Prediction Analysis** - Ground truth vs predicted scatterplots with R² and RMSE metrics
- **Error Analysis** - Residual histograms, MAE, and feature-wise error plots
- **Export Results** - Download training history and predictions

### Predict Tab
- **Manual Input** - Slider-based interface for all input features with validation
- **Point Selection** - Click on scatterplots to select existing data points
- **Airfoil Visualization** - 2D NACA 0012 airfoil profile showing angle of attack and velocity
- **Prediction History** - Track and compare multiple predictions

## Tech Stack

- React 19 + TypeScript + Vite
- TailwindCSS v4
- Zustand for state management
- TensorFlow.js for in-browser ML
- D3 for visualizations

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Type-check and build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Dataset

Uses the [NASA Airfoil Self-Noise Dataset](https://archive.ics.uci.edu/dataset/291/airfoil+self+noise) with 5 input features (frequency, angle of attack, chord length, free-stream velocity, suction side displacement thickness) to predict scaled sound pressure level.
