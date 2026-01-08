import { useEffect, useState, useCallback, useRef } from 'react';
import { useTutorialStore, TUTORIAL_STEPS } from '../../stores/tutorialStore';
import { useModelStore } from '../../stores/modelStore';
import { useFeatureStore } from '../../stores/featureStore';
import type { TabId } from '../../types';
import type { TransformType } from '../../utils/transforms';

interface TutorialOverlayProps {
  onTabChange: (tab: TabId) => void;
}

/**
 * Parse markdown content with wiki links into React elements
 */
function parseContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = linkRegex.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(...parseTextFormatting(text, key));
      key += 10;
    }

    // Add the link
    parts.push(
      <a
        key={`link-${key++}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:text-accent/80 underline font-medium"
      >
        {match[1]}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(...parseTextFormatting(content.slice(lastIndex), key));
  }

  return parts;
}

/**
 * Parse bold, italic, and code formatting
 */
function parseTextFormatting(text: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const formatRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|>[^\n]+)/g;
  let lastIndex = 0;
  let match;
  let key = baseKey;

  while ((match = formatRegex.exec(text)) !== null) {
    // Add text before the formatted part
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${key++}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    const matched = match[0];
    if (matched.startsWith('**') && matched.endsWith('**')) {
      // Bold
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold text-gray-900">
          {matched.slice(2, -2)}
        </strong>
      );
    } else if (matched.startsWith('*') && matched.endsWith('*')) {
      // Italic
      parts.push(
        <em key={`italic-${key++}`} className="italic">
          {matched.slice(1, -1)}
        </em>
      );
    } else if (matched.startsWith('`') && matched.endsWith('`')) {
      // Code
      parts.push(
        <code key={`code-${key++}`} className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-accent">
          {matched.slice(1, -1)}
        </code>
      );
    } else if (matched.startsWith('>')) {
      // Blockquote
      parts.push(
        <blockquote key={`quote-${key++}`} className="border-l-4 border-accent pl-3 my-2 italic text-gray-600">
          {matched.slice(1).trim()}
        </blockquote>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-end-${key++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts;
}

/**
 * Render markdown content as React elements
 */
function MarkdownContent({ content }: { content: string }) {
  const paragraphs = content.split('\n\n');

  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        // Check for list items
        if (para.includes('\n- ')) {
          const lines = para.split('\n');
          return (
            <div key={i}>
              {lines[0] && !lines[0].startsWith('-') && (
                <p className="text-gray-700 leading-relaxed mb-2">
                  {parseContent(lines[0])}
                </p>
              )}
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {lines.filter(l => l.startsWith('- ')).map((item, j) => (
                  <li key={j} className="leading-relaxed">
                    {parseContent(item.slice(2))}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // Check for numbered list
        if (/^\d+\./.test(para)) {
          const items = para.split(/\n(?=\d+\.)/).filter(Boolean);
          return (
            <ol key={i} className="list-decimal list-inside space-y-1 text-gray-700">
              {items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {parseContent(item.replace(/^\d+\.\s*/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={i} className="text-gray-700 leading-relaxed">
            {parseContent(para)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Spotlight highlight component
 */
function Spotlight({
  targetRect,
  padding = 8,
}: {
  targetRect: DOMRect | null;
  padding?: number;
}) {
  if (!targetRect) return null;

  const rect = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  return (
    <>
      {/* Dark overlay with cutout */}
      <div className="fixed inset-0 z-[998] pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>

      {/* Highlight border */}
      <div
        className="fixed z-[999] pointer-events-none rounded-lg ring-4 ring-accent ring-offset-2 transition-all duration-300"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
    </>
  );
}

/**
 * Main tutorial overlay component
 */
export function TutorialOverlay({ onTabChange }: TutorialOverlayProps) {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const isActive = useTutorialStore(state => state.isActive);
  const currentStepIndex = useTutorialStore(state => state.currentStepIndex);
  const isWaitingForTraining = useTutorialStore(state => state.isWaitingForTraining);
  const nextStep = useTutorialStore(state => state.nextStep);
  const prevStep = useTutorialStore(state => state.prevStep);
  const skipTutorial = useTutorialStore(state => state.skipTutorial);
  const endTutorial = useTutorialStore(state => state.endTutorial);
  const setWaitingForTraining = useTutorialStore(state => state.setWaitingForTraining);
  const getCurrentStep = useTutorialStore(state => state.getCurrentStep);
  const getProgress = useTutorialStore(state => state.getProgress);

  // Use selectors to avoid re-rendering on every training tick
  const trainingStatus = useModelStore(state => state.trainingStatus);
  const setConfig = useModelStore(state => state.setConfig);
  const setTrainingInputFeatureIds = useModelStore(state => state.setTrainingInputFeatureIds);
  const setTrainingTargetFeatureId = useModelStore(state => state.setTrainingTargetFeatureId);
  const resetModel = useModelStore(state => state.resetModel);
  const addTransformedFeature = useFeatureStore(state => state.addTransformedFeature);
  const getFeature = useFeatureStore(state => state.getFeature);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const prevStepRef = useRef<number>(-1);

  const currentStep = getCurrentStep();

  // Find and measure the target element
  const updateTargetRect = useCallback((shouldScroll = false) => {
    if (!currentStep?.highlightSelector) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(currentStep.highlightSelector);
    if (element) {
      // Scroll element into view if requested
      if (shouldScroll) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Update rect after scroll animation
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        }, 400);
      } else {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep?.highlightSelector]);

  // Calculate tooltip position
  const calculateTooltipPosition = useCallback(() => {
    const padding = 16;
    const tooltipWidth = 420;
    const tooltipHeight = 400; // Approximate max height

    if (!currentStep || currentStep.position === 'center' || !targetRect) {
      // Center horizontally, position near top with room to scroll
      setTooltipPosition({
        top: Math.max(padding, window.innerHeight * 0.08),
        left: window.innerWidth / 2 - tooltipWidth / 2,
      });
      return;
    }

    const pos = currentStep.position || 'right';
    let top = 0;
    let left = 0;

    switch (pos) {
      case 'right':
        top = Math.max(padding, Math.min(targetRect.top, window.innerHeight - tooltipHeight - padding));
        left = targetRect.right + padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
          left = targetRect.left - tooltipWidth - padding;
        }
        break;
      case 'left':
        top = Math.max(padding, Math.min(targetRect.top, window.innerHeight - tooltipHeight - padding));
        left = targetRect.left - tooltipWidth - padding;
        if (left < padding) {
          left = targetRect.right + padding;
        }
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = Math.max(padding, Math.min(targetRect.left, window.innerWidth - tooltipWidth - padding));
        if (top < padding) {
          top = targetRect.bottom + padding;
        }
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = Math.max(padding, Math.min(targetRect.left, window.innerWidth - tooltipWidth - padding));
        break;
    }

    setTooltipPosition({ top, left });
  }, [currentStep, targetRect]);

  // Handle step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Only apply config when step changes
    if (prevStepRef.current !== currentStepIndex) {
      prevStepRef.current = currentStepIndex;

      // Reset model before "click train" steps (not results steps)
      if (currentStep.requiresAction && currentStep.autoAdvanceOnTrainingStart) {
        resetModel();
      }

      // Navigate to correct tab
      if (currentStep.tab) {
        onTabChange(currentStep.tab);
      }

      // Apply auto-config after a small delay to let UI update
      const timer = setTimeout(() => {
        const config = currentStep.autoConfig;
        if (!config) return;

        // Apply model config
        if (config.modelConfig) {
          setConfig(config.modelConfig);
        }

        // Apply feature selection
        if (config.inputFeatures) {
          const validFeatures = config.inputFeatures.filter(id => getFeature(id));
          if (validFeatures.length > 0) {
            setTrainingInputFeatureIds(validFeatures);
          } else if (config.inputFeatures.length > 0) {
            setTrainingInputFeatureIds(['frequency', 'angleOfAttack', 'chordLength', 'freeStreamVelocity', 'suctionSideDisplacementThickness']);
          }
        }

        if (config.targetFeature) {
          const targetExists = getFeature(config.targetFeature);
          if (targetExists) {
            setTrainingTargetFeatureId(config.targetFeature);
          }
        }

        // Create transforms if specified
        if (config.createTransforms) {
          for (const transform of config.createTransforms) {
            const expectedId = `${transform.sourceFeatureId}_${transform.transform}_1`;
            if (!getFeature(expectedId)) {
              addTransformedFeature(
                transform.sourceFeatureId,
                transform.transform as TransformType,
                transform.params
              );
            }
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStepIndex]);

  // Watch for element changes
  useEffect(() => {
    if (!isActive) return;

    // Delay initial measurement and scroll to let DOM settle after step change
    const initialTimer = setTimeout(() => {
      updateTargetRect(true); // Scroll into view on step change
      calculateTooltipPosition();
    }, 150);

    // Throttled resize/scroll handler to avoid performance issues during training
    let rafId: number | null = null;
    const handleResize = () => {
      // Skip position updates during training to avoid performance issues
      if (trainingStatus === 'training') return;

      if (rafId) return; // Already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateTargetRect(false);
        calculateTooltipPosition();
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      clearTimeout(initialTimer);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isActive, currentStepIndex, updateTargetRect, calculateTooltipPosition, trainingStatus]);

  // Recalculate when target rect changes
  useEffect(() => {
    calculateTooltipPosition();
  }, [targetRect, calculateTooltipPosition]);

  // Watch training status for auto-advance on training start
  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Auto-advance when training STARTS (for "click train" steps)
    if (currentStep.autoAdvanceOnTrainingStart && trainingStatus === 'training') {
      // Immediately advance to the next step to observe training
      setTimeout(() => {
        nextStep();
      }, 100);
    }
  }, [trainingStatus, isActive, currentStep, nextStep]);

  // Watch training status for completion (for "observe results" steps)
  // Only update state when it actually changes to avoid re-render loops
  useEffect(() => {
    if (!isActive || !currentStep?.waitForTraining) return;

    if (trainingStatus === 'training' && !isWaitingForTraining) {
      setWaitingForTraining(true);
    } else if (trainingStatus === 'complete' && isWaitingForTraining) {
      setWaitingForTraining(false);
    }
  }, [trainingStatus, isActive, currentStep?.waitForTraining, isWaitingForTraining, setWaitingForTraining]);

  if (!isActive || !currentStep) return null;

  const progress = getProgress();
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  // Don't render spotlight during training to avoid performance issues
  const showSpotlight = trainingStatus !== 'training';

  return (
    <>
      {/* Spotlight highlight - hidden during training for performance */}
      {showSpotlight && (
        <Spotlight
          targetRect={targetRect}
          padding={currentStep.highlightPadding ?? 8}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[1000] w-[420px] max-h-[85vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-sm">
              {currentStepIndex + 1}
            </span>
            <h3 className="font-semibold text-gray-900">{currentStep.title}</h3>
          </div>
          <button
            onClick={skipTutorial}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Skip tutorial"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MarkdownContent content={currentStep.content} />

          {/* Action hint for steps that require user action */}
          {currentStep.requiresAction && !isWaitingForTraining && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-amber-700">
                {currentStep.actionLabel || 'Click the highlighted element to continue'}
              </span>
            </div>
          )}

          {/* Training indicator - uses static icon to avoid CSS animation repaints during training */}
          {isWaitingForTraining && (
            <div className="mt-4 p-3 bg-accent/5 rounded-lg border border-accent/20 flex items-center gap-3">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm text-accent font-medium">
                Training in progress... Please wait.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-sm text-gray-500">
            Step {currentStepIndex + 1} of {TUTORIAL_STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={prevStep}
                disabled={isWaitingForTraining}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
            )}
            {isLastStep ? (
              <button
                onClick={endTutorial}
                className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              >
                Finish
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={isWaitingForTraining || currentStep.requiresAction}
                className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isWaitingForTraining ? 'Training...' : currentStep.requiresAction ? 'Action Required' : 'Next'}
                {!isWaitingForTraining && !currentStep.requiresAction && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
