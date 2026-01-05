import type { TabId } from '../../types';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'explore', label: 'Explore Data', icon: '📊' },
  { id: 'train', label: 'Train Model', icon: '🧠' },
  { id: 'predict', label: 'Predict', icon: '🎯' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="bg-gray-100 border-b border-gray-200 sticky top-0 z-40">
      <div className="w-full px-6">
        <div className="flex justify-center gap-2 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-8 py-3 rounded-lg text-base font-medium transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'bg-white text-gray-600 hover:bg-primary-light hover:text-primary border border-gray-200'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
