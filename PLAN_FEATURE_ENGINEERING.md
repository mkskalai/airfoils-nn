# Feature Engineering & Plot Improvements - Development Plan

## Overview

This plan extends the airfoil app with advanced feature engineering capabilities, replacing the current normalization-in-training approach with a centralized feature store system.

**Key Changes:**
- New Feature Engineering section in Explore tab
- Centralized feature store with transforms and PCA
- Dynamic feature selection across all visualizations
- Enhanced plot capabilities (pairwise, log scale, download)

---

## Architecture Changes

### New State: Feature Store (`src/stores/featureStore.ts`)

```typescript
interface FeatureDefinition {
  id: string;                          // Unique identifier
  name: string;                        // Display name
  type: 'original' | 'transformed' | 'pca';
  sourceFeatures?: string[];           // For PCA/derived features
  transform?: 'none' | 'minmax' | 'zscore' | 'custom';
  customParams?: { min?: number; max?: number; mean?: number; std?: number };
  values: number[];                    // Computed values for all data points
  stats: FeatureStats;                 // min, max, mean, std, etc.
}

interface PCAResult {
  id: string;
  name: string;
  sourceFeatureIds: string[];          // Which features were used
  components: number[][];              // Eigenvectors (loadings)
  explainedVariance: number[];         // Per component
  explainedVarianceRatio: number[];    // Percentage per component
  projections: number[][];             // Data projected onto PCs
}

interface FeatureStore {
  features: Record<string, FeatureDefinition>;
  pcaResults: Record<string, PCAResult>;
  selectedFeatures: string[];          // For current visualization

  // Actions
  addTransformedFeature: (sourceId: string, transform: TransformType, params?: CustomParams) => void;
  runPCA: (featureIds: string[], numComponents: number) => PCAResult;
  savePCAComponents: (pcaId: string, componentIndices: number[]) => void;
  deleteFeature: (id: string) => void;
  setSelectedFeatures: (ids: string[]) => void;
}
```

### Data Flow Changes

```
Current:
  DataStore (raw + normalization) → Training → Prediction

New:
  DataStore (raw only)
      ↓
  FeatureStore (transforms, PCA, derived features)
      ↓
  Training (picks features from store)
      ↓
  Prediction (uses same feature pipeline)
```

---

## Work Packages

### WP-FE1: Feature Store Foundation
**Estimated complexity: Medium-High**

#### Tasks:
1. **Create Feature Store (`src/stores/featureStore.ts`):**
   - Initialize with 5 original features + target on data load
   - Store feature definitions with computed values
   - Track feature statistics (min, max, mean, std, quartiles)
   - Implement feature CRUD operations

2. **Transform Functions (`src/utils/transforms.ts`):**
   - Min-max normalization: `(x - min) / (max - min)`
   - Z-score standardization: `(x - mean) / std`
   - Custom transform with user-provided params
   - Inverse transforms for denormalization

3. **Feature Factory:**
   - `createTransformedFeature(source, transform, params)` → FeatureDefinition
   - Auto-generate unique IDs and names (e.g., "Frequency (z-score)")
   - Compute values and statistics on creation

4. **Persistence (optional):**
   - Consider localStorage for feature configurations
   - Export/import feature definitions as JSON

#### Deliverables:
- Working feature store with CRUD operations
- Transform utilities with inverse support
- Original 5 features auto-loaded
- Feature statistics computation

---

### WP-FE2: PCA Implementation
**Estimated complexity: High**

#### Tasks:
1. **PCA Algorithm (`src/utils/pca.ts`):**
   - Center data (subtract mean)
   - Compute covariance matrix
   - Eigendecomposition (use numeric.js or implement SVD)
   - Sort by explained variance
   - Return loadings, explained variance, projections

2. **PCA Store Integration:**
   - `runPCA(featureIds, numComponents)` action
   - Store PCA result with unique ID
   - Link to source features for reproducibility
   - Compute projections for all data points

3. **Save PCA as Features:**
   - `savePCAComponents(pcaId, indices)` action
   - Create FeatureDefinition for each saved PC
   - Store loading vectors for interpretation
   - Type: 'pca' with sourceFeatures reference

4. **PCA Inverse Transform:**
   - For prediction: reconstruct from PC values
   - Handle partial reconstructions

#### Technical Note:
Consider using `ml-pca` npm package or implementing SVD manually. TensorFlow.js has `tf.linalg.svd()` which could be leveraged.

#### Deliverables:
- Robust PCA computation
- Store integration for PCA results
- Ability to save PCs as features
- Loading vectors preserved for visualization

---

### WP-FE3: Feature Engineering UI
**Estimated complexity: Medium**

#### Tasks:
1. **Feature Engineering Panel (`src/components/explore/FeatureEngineering.tsx`):**
   - Collapsible section in Explore tab
   - Feature list with type badges (original, transformed, PCA)
   - Add/delete feature controls
   - Visual indicators for derived features

2. **Transform Dialog:**
   - Source feature selector (dropdown)
   - Transform type: None | Min-Max | Z-Score | Custom
   - Custom params inputs (min, max, mean, std)
   - Preview of transformed distribution
   - "Create Feature" button

3. **PCA Dialog (`src/components/explore/PCADialog.tsx`):**
   - Multi-select for input features (checkboxes)
   - Number of components slider (1 to num_features)
   - "Run PCA" button
   - Results display:
     - Explained variance bar chart
     - Cumulative variance line
     - Component selection checkboxes
   - "Save Selected Components" button

4. **Feature List Component:**
   - Drag-and-drop reordering (optional)
   - Delete button with confirmation
   - Prevent deletion of original features
   - Show feature dependencies (PCA source features)

#### Deliverables:
- Full feature engineering interface
- Transform creation workflow
- PCA workflow with component selection
- Feature management (add/delete)

---

### WP-FE4: PCA Visualizations
**Estimated complexity: Medium**

#### Tasks:
1. **Variance Explained Plot (`src/components/explore/VarianceExplainedChart.tsx`):**
   - Bar chart: individual variance per component
   - Line overlay: cumulative explained variance
   - X-axis: Component number (PC1, PC2, ...)
   - Y-axis: Percentage of variance
   - Threshold line at 95% (optional)
   - Interactive: hover to see exact values

2. **Loading Vectors Plot (`src/components/explore/PCALoadingsChart.tsx`):**
   - Biplot-style for 2 selected components
   - Arrows from origin showing feature loadings
   - Arrow length = loading magnitude
   - Color by feature
   - Feature labels at arrow tips
   - Optional: heatmap view of all loadings

3. **PCA Scatterplot (update existing):**
   - Multi-component pair selection
   - Color points by target or selected feature
   - Show data points in PC space
   - Overlay loading vectors option

4. **UI Integration:**
   - Add PCA visualizations to Explore tab
   - Selector for which PCA result to visualize
   - Toggle between biplot and heatmap views

#### Deliverables:
- Variance explained visualization
- Loading vectors visualization (biplot + heatmap)
- Enhanced PCA scatterplot
- Integrated UI for PCA exploration

---

### WP-FE5: Dynamic Feature Selection for Plots
**Estimated complexity: Medium-High**

#### Tasks:
1. **Feature Selector Component (`src/components/common/FeatureSelector.tsx`):**
   - Multi-select dropdown with checkboxes
   - Default: 5 original features selected
   - Add/remove features like training layers
   - Show feature type badges
   - "Select All" / "Clear" buttons
   - Drag to reorder (optional)

2. **Update Correlation Heatmap:**
   - Accept dynamic feature list
   - Recompute correlation matrix on selection change
   - Handle any number of features (not just 6)
   - Responsive sizing for large matrices

3. **Update Distribution Charts:**
   - Render histogram per selected feature
   - Dynamic grid layout based on count
   - Responsive 1-4 columns

4. **Feature Statistics Table (`src/components/explore/FeatureStatsTable.tsx`):**
   - Table with columns: Name, Type, Min, Max, Mean, Std, Missing
   - Updates when features added/removed
   - Sortable columns
   - Highlight derived features differently

5. **State Management:**
   - `selectedFeatures` in feature store
   - Sync across all Explore tab components
   - Persist selection in session

#### Deliverables:
- Reusable feature selector component
- Dynamic correlation heatmap
- Dynamic distribution charts
- Live-updating statistics table

---

### WP-FE6: Pairwise Scatterplot Matrix
**Estimated complexity: Medium-High**

#### Tasks:
1. **Scatterplot Matrix Component (`src/components/explore/ScatterplotMatrix.tsx`):**
   - Grid of scatterplots for all feature pairs
   - Diagonal: distribution histograms or feature name
   - Lower triangle: scatterplots
   - Upper triangle: correlation values (optional)
   - Color points by target variable

2. **Multi-Select Integration:**
   - Use feature selector for which features to include
   - Handle 2-10+ features gracefully
   - Responsive sizing (smaller plots for more features)

3. **Performance Optimizations:**
   - Canvas rendering for large matrices
   - Subsample points if > 500
   - Lazy render off-screen plots
   - WebGL option for very large matrices

4. **Interactivity:**
   - Linked brushing across all plots
   - Click plot to expand to full view
   - Hover tooltip showing all feature values
   - Zoom on individual plots

5. **Replace/Enhance Existing Scatterplot:**
   - Keep single scatterplot option
   - Add "Pairwise Matrix" view toggle
   - Share state between views

#### Deliverables:
- Full pairwise scatterplot matrix
- Linked interactions across plots
- Performance-optimized for large feature sets
- Toggle between single and matrix views

---

### WP-FE7: Training Tab Feature Selection
**Estimated complexity: Medium**

#### Tasks:
1. **Remove Normalization from Config Panel:**
   - Delete normalization section
   - Add note pointing to Explore → Feature Engineering

2. **Input Feature Selector:**
   - Multi-select for input features from feature store
   - Default: 5 original features
   - Allow any combination of original/transformed/PCA features
   - Validate: at least 1 feature, no duplicates

3. **Target Feature Selector:**
   - Dropdown for target variable
   - Default: Sound Pressure Level
   - Allow transformed versions of target

4. **Model Input Layer Update:**
   - Dynamic input size based on selected features
   - Update architecture preview
   - Update model builder utility

5. **Training Data Pipeline:**
   - Fetch selected feature values from store
   - Assume normalization handled by user through transforms, record the transforms order for inference
   - Cache prepared training data

6. **Error Plots Feature Selection:**
   - Add feature selector to ResidualVsFeature component
   - Default: input features used in training
   - Allow any features for analysis
   - Show 1 plot per selected feature

#### Deliverables:
- Feature-aware training configuration
- Dynamic model input size
- Error analysis with custom feature selection
- Removed normalization from training tab

---

### WP-FE8: Loss Chart Log Scale
**Estimated complexity: Low**

#### Tasks:
1. **Add Log Scale Toggle:**
   - Checkbox or toggle button: "Log Scale"
   - Position: top-right of loss chart

2. **Update Y-Axis:**
   - When enabled: use `d3.scaleLog()` instead of `d3.scaleLinear()`
   - Handle zero values (add small epsilon or filter)
   - Update tick format for log scale

3. **Smooth Transition:**
   - Animate axis change on toggle
   - Re-interpolate line paths

4. **Persist Preference:**
   - Store log scale preference in model store
   - Remember across training runs

#### Deliverables:
- Log scale toggle for loss chart
- Proper handling of small/zero values
- Smooth axis transitions

---

### WP-FE9: Plot Download Functionality
**Estimated complexity: Medium**

#### Tasks:
1. **Download Utility (`src/utils/download.ts`):**
   - SVG to PNG conversion
   - SVG to SVG download (with styles inlined)
   - Data export to CSV

2. **Download Button Component (`src/components/common/DownloadButton.tsx`):**
   - Icon button (download icon)
   - Dropdown: PNG | SVG | CSV (for data plots)
   - Position: top-right corner of each chart

3. **Add to All Charts:**
   - Correlation Heatmap: PNG, SVG
   - Distribution Charts: PNG, SVG, CSV (histogram bins)
   - Scatterplots: PNG, SVG, CSV (point data)
   - Scatterplot Matrix: PNG, SVG
   - PCA Variance Plot: PNG, SVG, CSV
   - PCA Loadings: PNG, SVG, CSV
   - Loss Chart: PNG, SVG, CSV (epoch, train_loss, val_loss)
   - GT vs Pred: PNG, SVG, CSV
   - Error Analysis: PNG, SVG, CSV
   - Network Viz: PNG, SVG
   - Airfoil Viz: PNG, SVG

4. **Styling for Export:**
   - Inline CSS for SVG export
   - White background for PNG
   - Include legends and labels
   - High-resolution option (2x, 3x)

5. **Filename Generation:**
   - Descriptive names with timestamp
   - Example: `correlation_heatmap_2024-01-15.png`

#### Deliverables:
- Download capability on all charts
- Multiple format options (PNG, SVG, CSV)
- Clean exported images with proper styling

---

## Implementation Order

```
WP-FE1 (Feature Store)
    ↓
WP-FE2 (PCA Implementation)
    ↓
WP-FE3 (Feature Engineering UI)
    ↓
WP-FE4 (PCA Visualizations)
    ↓
WP-FE5 (Dynamic Feature Selection)  ←── Major UX change
    ↓
WP-FE6 (Pairwise Scatterplot Matrix)
    ↓
WP-FE7 (Training Tab Feature Selection)  ←── Remove normalization here
    ↓
WP-FE8 (Log Scale for Loss)  ←── Quick win
    ↓
WP-FE9 (Plot Downloads)  ←── Final polish
```

---

## New/Modified Files

### New Files:
```
src/stores/featureStore.ts           # Feature store (new)
src/utils/pca.ts                     # PCA algorithm
src/utils/transforms.ts              # Transform functions
src/utils/download.ts                # Chart download utilities
src/components/explore/FeatureEngineering.tsx
src/components/explore/PCADialog.tsx
src/components/explore/VarianceExplainedChart.tsx
src/components/explore/PCALoadingsChart.tsx
src/components/explore/ScatterplotMatrix.tsx
src/components/explore/FeatureStatsTable.tsx
src/components/common/FeatureSelector.tsx
src/components/common/DownloadButton.tsx
```

### Modified Files:
```
src/stores/dataStore.ts              # Remove normalization, link to feature store
src/components/explore/ExploreTab.tsx # Add feature engineering section
src/components/explore/CorrelationHeatmap.tsx # Dynamic features
src/components/explore/DistributionChart.tsx  # Dynamic features
src/components/explore/Scatterplot.tsx        # Multi-select, matrix option
src/components/train/ConfigPanel.tsx          # Remove normalization, add feature selection
src/components/train/LossChart.tsx            # Add log scale toggle
src/components/train/ResidualVsFeature.tsx    # Feature selection
src/hooks/useTraining.ts                      # Use features from store
```

---

## UI/UX Considerations

### Feature Engineering Section Layout:
```
┌─────────────────────────────────────────────────┐
│ Feature Engineering                        [+]  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ Feature List                                │ │
│ │ ─────────────────────────────────────────── │ │
│ │ ● Frequency           [original]        [x] │ │
│ │ ● Angle of Attack     [original]        [x] │ │
│ │ ● Chord Length        [original]        [x] │ │
│ │ ● Velocity            [original]        [x] │ │
│ │ ● Displacement        [original]        [x] │ │
│ │ ● Frequency (z-score) [transformed]     [🗑]│ │
│ │ ● PC1                 [pca]             [🗑]│ │
│ │ ● PC2                 [pca]             [🗑]│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [+ Add Transform]  [+ Run PCA]                  │
└─────────────────────────────────────────────────┘
```

### PCA Dialog Layout:
```
┌─────────────────────────────────────────────────┐
│ Principal Component Analysis                    │
├─────────────────────────────────────────────────┤
│ Select Features:                                │
│ [x] Frequency                                   │
│ [x] Angle of Attack                             │
│ [x] Chord Length                                │
│ [x] Velocity                                    │
│ [x] Displacement                                │
│                                                 │
│ Components: [3] ──●────────── (1-5)             │
│                                                 │
│                    [Run PCA]                    │
├─────────────────────────────────────────────────┤
│ Results:                                        │
│ ┌───────────────────────────────────────────┐   │
│ │ Variance Explained Chart                  │   │
│ │  50%|████████████                         │   │
│ │  30%|███████                              │   │
│ │  15%|████                                 │   │
│ │      PC1    PC2    PC3                    │   │
│ │      ─── Cumulative: 95% ───              │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ Save Components:                                │
│ [x] PC1 (50.2%)  [ ] PC2 (29.8%)  [ ] PC3       │
│                                                 │
│                   [Save to Feature Store]       │
└─────────────────────────────────────────────────┘
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "ml-pca": "^4.1.1",        // PCA computation (or use TF.js SVD)
    "file-saver": "^2.0.5",    // Download utility
    "canvas-to-blob": "^1.0.0" // SVG to PNG conversion (optional)
  }
}
```

Alternative: Implement PCA using TensorFlow.js `tf.linalg.svd()` to avoid new dependencies.

---

## Risk Areas & Mitigations

| Risk | Mitigation |
|------|------------|
| PCA on small dataset (1503 samples) | Standard PCA should work fine; no dimensionality concerns |
| Feature store memory with many derived features | Limit total features (e.g., 20); warn user |
| Scatterplot matrix performance with 10+ features | Canvas rendering, subsampling, lazy loading |
| Training with derived features | Ensure transform pipeline is serializable for prediction |
| Log scale with zero loss values | Add epsilon (1e-10) or show warning |
| SVG download styling | Inline all CSS; test across browsers |

---

## Success Criteria

1. **Feature Engineering:**
   - [ ] Can create min-max, z-score, and custom transforms
   - [ ] Can run PCA on any subset of features
   - [ ] Can save PCA components as new features
   - [ ] Can delete derived features (not originals)

2. **PCA Visualizations:**
   - [ ] Variance explained plot shows individual + cumulative
   - [ ] Loading vectors plotted as biplot
   - [ ] Can select which components to visualize

3. **Dynamic Feature Selection:**
   - [ ] All plots update when features added/removed
   - [ ] Feature statistics table is live-updating
   - [ ] Correlation heatmap works with any number of features

4. **Pairwise Scatterplots:**
   - [ ] Matrix view with diagonal distributions
   - [ ] Linked brushing across plots
   - [ ] Performance acceptable with 8+ features

5. **Training Integration:**
   - [ ] Normalization removed from training tab
   - [ ] Can select any features as model inputs
   - [ ] Error plots allow custom feature selection

6. **Polish:**
   - [ ] Loss chart has working log scale toggle
   - [ ] All plots downloadable as PNG/SVG/CSV
   - [ ] Export files are properly styled

---

## Notes

- This is a significant architectural change; consider feature flags for gradual rollout
- The feature store becomes the single source of truth for all feature data
- Backward compatibility: existing trained models may need migration path
- Consider adding "reset to defaults" option for feature selection
