import type { TabId } from '../../types';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; shortLabel: string; icon: string }[] = [
  { id: 'explore', label: 'Explore Data', shortLabel: 'Explore', icon: '📊' },
  { id: 'train', label: 'Train Model', shortLabel: 'Train', icon: '🧠' },
  { id: 'predict', label: 'Predict', shortLabel: 'Predict', icon: '🎯' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="bg-gray-100 border-b border-gray-200 sticky top-0 z-40">
      <div className="w-full px-2 sm:px-4 md:px-6">
        <div className="flex justify-center gap-1 sm:gap-2 py-2 sm:py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-3 sm:px-5 md:px-8 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200
                flex items-center gap-1 sm:gap-2
                ${activeTab === tab.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'bg-white text-gray-600 hover:bg-primary-light hover:text-primary border border-gray-200'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
