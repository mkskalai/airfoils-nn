import { useMemo } from 'react';
import type { DataPoint, DatasetStats } from '../../types';
import { FEATURE_NAMES } from '../../types';

interface InputFormProps {
  values: Record<keyof Omit<DataPoint, 'soundPressureLevel'>, number>;
  onChange: (key: keyof Omit<DataPoint, 'soundPressureLevel'>, value: number) => void;
  stats: DatasetStats | null;
  disabled: boolean;
  onPredict: () => void;
}

// Feature configurations with units and step sizes
const FEATURE_CONFIG: Record<
  keyof Omit<DataPoint, 'soundPressureLevel'>,
  { unit: string; step: number; precision: number }
> = {
  frequency: { unit: 'Hz', step: 100, precision: 0 },
  angleOfAttack: { unit: '°', step: 0.5, precision: 1 },
  chordLength: { unit: 'm', step: 0.01, precision: 4 },
  freeStreamVelocity: { unit: 'm/s', step: 1, precision: 1 },
  suctionSideDisplacementThickness: { unit: 'm', step: 0.0001, precision: 6 },
};

// Short labels for compact display
const SHORT_LABELS: Record<keyof Omit<DataPoint, 'soundPressureLevel'>, string> = {
  frequency: 'Frequency',
  angleOfAttack: 'Angle of Attack',
  chordLength: 'Chord Length',
  freeStreamVelocity: 'Velocity',
  suctionSideDisplacementThickness: 'SSDT',
};

export function InputForm({ values, onChange, stats, disabled, onPredict }: InputFormProps) {
  // Calculate ranges from stats
  const ranges = useMemo(() => {
    if (!stats) return null;

    const result: Record<string, { min: number; max: number }> = {};
    for (const key of FEATURE_NAMES) {
      const padding = (stats[key].max - stats[key].min) * 0.1;
      result[key] = {
        min: Math.max(0, stats[key].min - padding),
        max: stats[key].max + padding,
      };
    }
    return result;
  }, [stats]);

  const handleSliderChange = (
    key: keyof Omit<DataPoint, 'soundPressureLevel'>,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(key, parseFloat(e.target.value));
  };

  const handleInputChange = (
    key: keyof Omit<DataPoint, 'soundPressureLevel'>,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      onChange(key, value);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
        <span className="text-2xl">📥</span>
        Input Features
      </h3>

      <div className="space-y-5">
        {FEATURE_NAMES.map((key) => {
          const config = FEATURE_CONFIG[key];
          const range = ranges?.[key];
          const value = values[key];
          const inRange = range && value >= range.min && value <= range.max;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {SHORT_LABELS[key]}
                  <span className="text-gray-400 ml-1">({config.unit})</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={value.toFixed(config.precision)}
                    onChange={(e) => handleInputChange(key, e)}
                    disabled={disabled}
                    step={config.step}
                    min={range?.min}
                    max={range?.max}
                    className={`w-32 px-3 py-1.5 text-sm border-2 rounded-lg text-right
                      focus:ring-2 focus:ring-accent focus:border-accent
                      disabled:bg-gray-100 disabled:cursor-not-allowed
                      transition-colors font-mono
                      ${!inRange && range ? 'border-warm/50 bg-warm-light/30' : 'border-gray-200'}`}
                  />
                  <span className="text-xs text-gray-400 w-10">{config.unit}</span>
                </div>
              </div>

              {range && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16 text-right">
                    {range.min.toFixed(config.precision)}
                  </span>
                  <input
                    type="range"
                    value={value}
                    onChange={(e) => handleSliderChange(key, e)}
                    disabled={disabled}
                    min={range.min}
                    max={range.max}
                    step={config.step}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                      disabled:cursor-not-allowed
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:bg-accent
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-md
                      [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                      disabled:[&::-webkit-slider-thumb]:bg-gray-400"
                  />
                  <span className="text-xs text-gray-400 w-16">
                    {range.max.toFixed(config.precision)}
                  </span>
                </div>
              )}

              {/* Dataset range indicator */}
              {stats && (
                <div className="text-xs text-gray-400 flex justify-between px-1">
                  <span>Dataset: {stats[key].min.toFixed(config.precision)} - {stats[key].max.toFixed(config.precision)}</span>
                  {!inRange && <span className="text-warm">⚠️ Outside dataset range</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onPredict}
        disabled={disabled}
        className="w-full mt-8 py-4 bg-accent text-white text-lg font-semibold rounded-lg
          hover:bg-accent/90 disabled:bg-gray-300 disabled:cursor-not-allowed
          transition-colors shadow-lg shadow-accent/20
          active:scale-[0.99]"
      >
        🎯 Predict Sound Level
      </button>

      {/* Quick tips */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>💡 Use sliders for quick adjustment, number inputs for precision</p>
        <p>💡 Click on data points in the scatterplot to auto-fill values</p>
      </div>
    </div>
  );
}
