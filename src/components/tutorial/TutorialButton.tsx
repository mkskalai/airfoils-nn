import { useTutorialStore } from '../../stores/tutorialStore';

/**
 * Button to start/restart the tutorial, shown in header
 */
export function TutorialButton() {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const isActive = useTutorialStore(state => state.isActive);
  const showWelcomeDialog = useTutorialStore(state => state.showWelcomeDialog);

  if (isActive) return null;

  return (
    <button
      onClick={showWelcomeDialog}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white text-sm font-medium"
      title="Start interactive tutorial"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      Tutorial
    </button>
  );
}
