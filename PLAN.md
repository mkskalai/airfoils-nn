# Airfoil Neural Network Interactive Website - Development Plan

## Project Overview

Build an interactive client-side web application that:
- Explores the NASA airfoil self-noise dataset
- Trains a configurable neural network using TensorFlow.js
- Provides predictions with visualizations

**Tech Stack:**
- **Framework:** React + Vite + TypeScript
- **ML:** TensorFlow.js
- **Visualization:** D3.js
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Navigation:** State-based tabs (no router)

**Dataset:** Bundled locally from [UCI Airfoil Self-Noise](https://archive.ics.uci.edu/ml/machine-learning-databases/00291/airfoil_self_noise.dat)

**Features:**
1. Frequency (Hz)
2. Angle of attack (degrees)
3. Chord length (m)
4. Free-stream velocity (m/s)
5. Suction side displacement thickness (m)

**Target:** Scaled sound pressure level (dB)

---

## Color Scheme

| Element | Color |
|---------|-------|
| Low values (cold) | Deep blue `#1a237e` |
| Neutral | White `#ffffff` |
| High values (warm) | Deep orange `#e65100` |
| Background | Light gray `#f5f5f5` |
| UI elements | Gray tones, minimal borders |
| Positive weights | Orange gradient |
| Negative weights | Blue gradient |

---

## Work Packages

### WP1: Project Setup & Infrastructure
**Estimated complexity: Low**

#### Tasks:
1. Initialize React project with Vite + TypeScript
2. Install and configure dependencies:
   - `@tensorflow/tfjs` - neural network
   - `d3` + `@types/d3` - visualizations
   - `zustand` - state management
   - `tailwindcss` + `postcss` + `autoprefixer` - styling
3. Configure Tailwind CSS:
   - Set up `tailwind.config.js` with custom color scheme
   - Define color palette: deep blue (`#1a237e`), deep orange (`#e65100`), grays
   - Configure background color (`#f5f5f5`)
4. Set up project structure:
   ```
   src/
   ├── components/
   │   ├── common/          # Shared UI components
   │   ├── explore/         # Tab 1 components
   │   ├── train/           # Tab 2 components
   │   └── predict/         # Tab 3 components
   ├── hooks/               # Custom React hooks
   ├── stores/              # Zustand stores
   ├── utils/               # Data processing, math utilities
   └── types/               # TypeScript interfaces
   ```
5. Create base layout with state-based tab navigation
6. Set up Zustand stores skeleton (dataStore, modelStore)
7. Download and place dataset in `public/airfoil_self_noise.dat`

#### Deliverables:
- Working React + Vite app with Tailwind configured
- State-based navigation between 3 tabs
- Zustand store structure in place
- Dataset bundled locally
- Consistent styling foundation with custom color scheme

---

### WP2: Data Layer
**Estimated complexity: Medium**

#### Tasks:
1. **Data Loading:**
   - Fetch dataset from local `/airfoil_self_noise.dat`
   - Parse whitespace-separated values into typed arrays
   - Handle loading and error states

2. **Data Structures (TypeScript):**
   - `DataPoint` interface for individual samples
   - `DatasetStats` interface for column statistics
   - `Dataset` interface combining raw data + stats

3. **Zustand Data Store (`useDataStore`):**
   - Raw data storage (1503 samples)
   - Column statistics (min, max, mean, std per feature)
   - Normalized data cache (updated when normalization changes)
   - Loading/error states
   - Actions: `loadData()`, `setNormalizationType()`

4. **Data Processing Utilities (`utils/data.ts`):**
   - Min-max normalization
   - Z-score standardization
   - Denormalization for predictions
   - Train/validation split function (stratified optional)

5. **Statistical Computations (`utils/stats.ts`):**
   - Correlation matrix calculation (Pearson)
   - PCA implementation (eigendecomposition or SVD)
   - Histogram binning utility

#### Deliverables:
- Robust data loading and parsing from local file
- Normalization utilities with denormalization support
- Statistical computations ready for visualizations
- Zustand store accessible from all components

---

### WP3: Tab 1 - Data Exploration
**Estimated complexity: Medium-High**

#### Tasks:
1. **Layout:**
   - Responsive grid for multiple visualizations
   - Controls for selecting features to visualize

2. **Scatterplot Component (D3.js):**
   - Reusable scatterplot with configurable X/Y axes
   - Feature selectors (dropdowns)
   - Color coding by target variable (sound pressure level)
   - Tooltips showing data point details
   - Zoom and pan support
   - Brush selection for data subset exploration

3. **Correlation Heatmap (D3.js):**
   - 6x6 matrix (5 features + 1 target)
   - Blue-white-orange diverging color scale
   - Hover tooltips with exact correlation values
   - Labels for all variables

4. **Distribution Plots:**
   - Histogram for each feature
   - Option to overlay kernel density estimate
   - Summary statistics display (mean, std, min, max)

5. **Interactivity:**
   - Linked brushing across visualizations
   - Feature selector shared across components

#### Deliverables:
- Interactive scatterplot matrix
- Correlation heatmap
- Distribution histograms
- Coordinated interactions between views

---

### WP4: Tab 2 - Neural Network Configuration UI
**Estimated complexity: Medium**

#### Tasks:
1. **Normalization Options:**
   - Toggle: None / Min-Max / Z-Score
   - Display data statistics

2. **Architecture Configuration:**
   - Number of hidden layers (1-5 slider/input)
   - Neurons per layer (dynamic inputs per layer)
   - Activation function per layer (ReLU, Sigmoid, Tanh, LeakyReLU)
   - Visual preview of architecture as you configure

3. **Training Parameters:**
   - Learning rate (input with common presets: 0.001, 0.01, 0.1)
   - Number of epochs/steps
   - Batch size
   - Validation split percentage (slider 10-40%)

4. **Regularization:**
   - L1 regularization strength (0 = off)
   - L2 regularization strength (0 = off)
   - Dropout rate per layer (optional)

5. **Control Buttons:**
   - Train button
   - Stop/Pause button
   - Reset model button
   - Export model button (optional)

#### Deliverables:
- Complete configuration panel
- Form validation
- State management for all parameters
- Real-time architecture preview

---

### WP5: Tab 2 - TensorFlow.js Model & Training
**Estimated complexity: High**

#### Tasks:
1. **Model Builder:**
   - Dynamic model construction from configuration
   - Input layer (5 features)
   - Hidden layers with specified neurons/activations
   - Output layer (1 neuron, linear activation)
   - Apply L1/L2 regularizers to layers

2. **Training Pipeline:**
   - Compile model with MSE loss and Adam optimizer
   - Implement training loop with:
     - Batch processing
     - Epoch callbacks for UI updates
     - Validation evaluation
   - Memory management (dispose tensors properly)

3. **Zustand Model Store (`useModelStore`):**
   - TF.js model reference
   - Training history (loss, val_loss per epoch)
   - Current epoch/step counter
   - Training status (idle, training, paused, complete)
   - Best model checkpoint (lowest val_loss)
   - Model configuration (for rebuild)

4. **Performance Considerations:**
   - Use `tf.tidy()` for automatic cleanup
   - Yield to UI thread periodically
   - Optional: Web Worker for training (advanced)

#### Deliverables:
- Configurable TF.js model builder
- Robust training loop with callbacks
- Training state accessible for visualizations

---

### WP6: Tab 2 - Loss Visualization
**Estimated complexity: Low-Medium**

#### Tasks:
1. **Line Chart Component (D3.js):**
   - X-axis: Epoch/Step
   - Y-axis: Loss value
   - Two lines: Training loss, Validation loss
   - Legend
   - Auto-scaling axes as training progresses

2. **Real-time Updates:**
   - Efficient append-only rendering
   - Smooth transitions for new points
   - Performance optimization for many epochs

3. **Styling:**
   - Training loss: solid line
   - Validation loss: dashed line
   - Grid lines for readability
   - Current best validation loss marker

#### Deliverables:
- Live-updating loss chart
- Clear distinction between train/val loss
- Smooth performance during training

---

### WP6.5: Tab 2 - GT vs Predicted Scatterplots ✅ IMPLEMENTED
**Estimated complexity: Medium**

#### Tasks:
1. **Model Store Updates:**
   - Add `trainPredictions` and `valPredictions` arrays to store GT vs Pred pairs
   - Add `predictionUpdateInterval` setting (default: 10 epochs)
   - Add `setPredictions` and `setPredictionUpdateInterval` actions

2. **Training Hook Updates:**
   - Compute predictions every N epochs (configurable)
   - Always compute on last epoch
   - Denormalize predictions back to original scale (dB)
   - Store prediction points for visualization

3. **PredictionScatterplot Component (D3.js):**
   - X-axis: Ground Truth values (original dB scale)
   - Y-axis: Predicted values (original dB scale)
   - Diagonal y=x reference line (dashed)
   - Dotted residual lines from each point to diagonal
   - R² and RMSE metrics computed on original quantities
   - Interactive tooltips showing GT, Pred, and Residual
   - Adaptive point sizing based on dataset size

4. **UI Integration:**
   - Two side-by-side scatterplots (Train and Validation)
   - Color-coded: Train (accent blue), Validation (warm orange)
   - Sample count display
   - Configurable update interval slider (1-50 epochs)

#### Deliverables:
- Real-time GT vs Pred visualization during training
- Clear model performance metrics (R², RMSE) on original scale
- Configurable update frequency for performance

---

### WP7: Tab 2 - Error Analysis ✅ IMPLEMENTED
**Estimated complexity: Medium**

#### Tasks:
1. **Residual Distribution:**
   - Histogram of prediction residuals (pred - gt)
   - Show for both train and validation sets
   - Compute and display mean, std, skewness of residuals
   - Ideal: centered at 0, symmetric distribution

2. **Residual vs Feature Plots:**
   - One plot per input feature
   - X-axis: Feature value, Y-axis: Residual
   - Identify features where model struggles
   - Detect non-linear patterns the model missed

3. **Error Metrics Summary:**
   - MAE, MSE, RMSE, R²
   - Max absolute error
   - Percentage of predictions within certain thresholds (e.g., ±1dB, ±3dB)

4. **UI Integration:**
   - Add as a section below the scatter plots in Training tab
   - Update after training completes
   - Option to view train vs validation separately

#### Deliverables:
- Comprehensive error analysis dashboard
- Residual diagnostics for model improvement
- Clear identification of model weaknesses

---

### WP8: Tab 2 - Network Architecture Visualization ✅ IMPLEMENTED
**Estimated complexity: High**

#### Tasks:
1. **Layout Algorithm:**
   - Compute node positions for each layer
   - Input layer (5 nodes) → Hidden layers → Output (1 node)
   - Vertical or horizontal layout option
   - Responsive sizing

2. **Node Rendering:**
   - Circles for neurons
   - Labels (feature names for input, "Output" for output)
   - Activation function indicator per layer
   - Bias node indication (optional)

3. **Connection Rendering:**
   - Lines connecting all neurons between adjacent layers
   - **Width proportional to absolute weight value**
   - **Color based on weight sign:**
     - Positive: Orange gradient
     - Negative: Blue gradient
   - Opacity or saturation for weight magnitude

4. **Weight Updates:**
   - Extract weights from TF.js model
   - Update visualization after each epoch/batch
   - Smooth transitions for weight changes

5. **Interactivity:**
   - Hover on connection to see exact weight value
   - Hover on neuron to highlight its connections
   - Zoom for large networks

#### Deliverables:
- Dynamic neural network diagram
- Weight visualization with width and color encoding
- Live updates during training

---

### WP9: Tab 3 - Prediction Interface ✅ IMPLEMENTED
**Estimated complexity: Medium**

#### Tasks:
1. **Manual Input Form:**
   - 5 input fields with labels and units:
     - Frequency (Hz)
     - Angle of attack (degrees)
     - Chord length (m)
     - Free-stream velocity (m/s)
     - Suction side displacement thickness (m)
   - Validation with min/max from dataset
   - Slider + number input combination

2. **Prediction Display:**
   - Large, prominent prediction result
   - Units (dB)
   - Confidence/uncertainty indicator (optional: if using dropout at inference)
   - Comparison with nearest data points

3. **Scatterplot Point Selection:**
   - Reuse scatterplot component from Tab 1
   - Click on point to populate input fields
   - Highlight selected point
   - Show actual vs predicted for selected point

4. **Prediction History:**
   - List of recent predictions
   - Option to compare multiple scenarios

#### Deliverables:
- Working prediction interface
- Both manual and click-to-select input methods
- Clear prediction output display

---

### WP10: Tab 3 - 2D Airfoil Visualization ✅ IMPLEMENTED
**Estimated complexity: Medium**

#### Tasks:
1. **NACA 0012 Profile Generation:**
   - Implement NACA 4-digit airfoil equation
   - Generate upper and lower surface coordinates
   - Scale by chord length input

2. **Airfoil Rendering (D3.js or SVG):**
   - Draw airfoil cross-section
   - Annotate chord length
   - Show angle of attack (rotate airfoil or show reference)
   - Wind direction indicator

3. **Dynamic Updates:**
   - Update when inputs change
   - Smooth transitions for parameter changes

#### Deliverables:
- Accurate NACA 0012 airfoil visualization
- Dynamic updates based on input parameters
- Clear visual representation of the physical setup

---

### WP11: Polish & Integration
**Estimated complexity: Medium**

#### Tasks:
1. **Cross-tab State:**
   - Trained model accessible from Tab 3
   - Ensure predictions use current model
   - Handle "no model trained yet" state

2. **Loading States:**
   - Dataset loading indicator
   - Training progress indicator
   - Prediction loading state

3. **Error Handling:**
   - Dataset fetch failures
   - Invalid model configurations
   - Training errors (NaN loss, etc.)
   - User-friendly error messages

4. **Responsive Design:**
   - Mobile-friendly layouts
   - Resizable visualization panels
   - Touch interactions for mobile

5. **Performance Optimization:**
   - Lazy loading of D3 visualizations
   - Memoization of expensive computations
   - Efficient re-renders

6. **Final Styling:**
   - Consistent spacing and typography
   - Smooth animations and transitions
   - Polish color scheme application

#### Deliverables:
- Fully integrated application
- Robust error handling
- Responsive, polished UI

---

### WP12: Tab 1 - PCA Analysis in Data Visualization
**Estimated complexity: Medium**

#### Tasks:
1. **PCA Computation:**
   - Compute PCA on the 5 input features
   - Calculate explained variance ratio for each component
   - Store PC1 and PC2 projections for all data points

2. **PCA Scatterplot (D3.js):**
   - X-axis: PC1, Y-axis: PC2
   - Points colored by target variable (sound pressure level)
   - Diverging color scale for noise level
   - Interactive tooltips showing PC coordinates and all feature values
   - Explained variance display in axis labels

3. **Loading Plot:**
   - Show feature contribution to each principal component
   - Bar chart or vector representation
   - Helps interpret what PC1 and PC2 represent

4. **UI Integration:**
   - Add as a visualization option in the Explore tab
   - Display total explained variance
   - Link with other explore visualizations

#### Deliverables:
- PCA visualization of the dataset
- Clear feature loading interpretation
- Understanding of data structure in reduced dimensions

---

## Implementation Order (Recommended)

```
WP1 (Setup)              ✅ DONE
    ↓
WP2 (Data Layer)         ✅ DONE
    ↓
WP3 (Explore Tab)        ✅ DONE ←── Can demo early
    ↓
WP4 (NN Config UI)       ✅ DONE
    ↓
WP5 (TF.js Training)     ✅ DONE
    ↓
WP6 (Loss Chart)         ✅ DONE ←── First training visualization
    ↓
WP6.5 (GT vs Pred)       ✅ DONE ←── Model evaluation visualization
    ↓
WP7 (Error Analysis)     ✅ DONE ←── Training diagnostics
    ↓
WP8 (Architecture Viz)   ✅ DONE ←── Complete training tab
    ↓
WP9 (Prediction UI)      ✅ DONE ←── Prediction interface complete
    ↓
WP10 (Airfoil Viz)       ✅ DONE ←── 2D NACA 0012 visualization
    ↓
WP11 (Polish)
    ↓
WP12 (PCA Analysis) ←── Data exploration enhancement
```

---

## Risk Areas & Mitigations

| Risk | Mitigation |
|------|------------|
| TF.js memory leaks | Rigorous use of `tf.tidy()` and `tensor.dispose()` |
| Slow training blocking UI | Use `await tf.nextFrame()` in training loop |
| Large model weight viz | Limit visible connections; add filtering options |
| Mobile performance | Reduce visualization resolution; lazy load |
| D3 + React conflicts | Use refs and useEffect; let D3 handle SVG, React handle lifecycle |

---

## File Structure (Proposed)

```
airfoils/
├── public/
│   └── airfoil_self_noise.dat     # Local dataset
├── src/
│   ├── App.tsx                    # Main app with tab state
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Tailwind imports + globals
│   ├── components/
│   │   ├── common/
│   │   │   ├── TabNavigation.tsx
│   │   │   ├── ColorScale.tsx
│   │   │   └── Tooltip.tsx
│   │   ├── explore/
│   │   │   ├── ExploreTab.tsx
│   │   │   ├── Scatterplot.tsx
│   │   │   ├── CorrelationHeatmap.tsx
│   │   │   ├── DistributionChart.tsx
│   │   │   └── PCAScatterplot.tsx
│   │   ├── train/
│   │   │   ├── TrainTab.tsx
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── LossChart.tsx
│   │   │   ├── PredictionScatterplot.tsx
│   │   │   ├── ErrorAnalysis.tsx
│   │   │   └── NetworkViz.tsx
│   │   └── predict/
│   │       ├── PredictTab.tsx
│   │       ├── InputForm.tsx
│   │       ├── PointSelector.tsx
│   │       └── AirfoilViz.tsx
│   ├── stores/
│   │   ├── dataStore.ts           # Zustand: dataset, stats, normalization
│   │   └── modelStore.ts          # Zustand: model, training state, history
│   ├── hooks/
│   │   └── useTraining.ts         # Training loop logic
│   ├── utils/
│   │   ├── data.ts                # Parsing, normalization
│   │   ├── stats.ts               # Correlation, PCA
│   │   ├── naca.ts                # Airfoil geometry
│   │   └── colors.ts              # Color scales (D3 compatible)
│   └── types/
│       └── index.ts               # All TypeScript interfaces
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── tsconfig.json
└── PLAN.md
```

---

## Notes for Implementation

1. **Start Simple:** Begin with minimal viable versions of each component, then enhance.

2. **Test with Data Early:** Load the real dataset as soon as WP2 is done to catch parsing issues.

3. **D3 + React Integration:** Use D3 for calculations and DOM manipulation within `useEffect`, letting React handle component lifecycle.

4. **TypeScript Throughout:** Strong typing will catch errors early, especially for tensor shapes.

5. **Git Commits:** Commit after each WP for easy rollback and progress tracking.

---

## Architecture Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dataset hosting | **Local** (bundled in `public/`) | Avoids CORS issues, works offline |
| Routing | **State-based tabs** | Simpler, sufficient for single-purpose app |
| Styling | **Tailwind CSS** | Rapid development, consistent design system |
| State management | **Zustand** | Cleaner than Context, better performance, minimal API |
