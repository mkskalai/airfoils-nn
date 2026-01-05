# Airfoil Noise Prediction

Browser-based neural network app for predicting airfoil self-noise using TensorFlow.js. Explore the NASA Airfoil Self-Noise Dataset, train custom models, and make predictions—all in your browser.

## Features

- **Explore** - Dataset statistics, correlation heatmaps, distributions, and scatterplots
- **Train** - Configure neural network architecture and train with real-time loss visualization
- **Predict** - Make predictions using trained models

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
