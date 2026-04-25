import React from 'react';
import { useNavigation } from '../navigation/NavigationContext';
import { AppRoute } from '../types';

const TabBar: React.FC = () => {
  const { currentRoute, setCurrentRoute } = useNavigation();

  const tabs = [
    { route: AppRoute.ACADEMY, icon: '🏠', label: 'Académie' },
    { route: AppRoute.LEAGUES, icon: '🛡️', label: 'Ligues' },
    { route: AppRoute.TROPHIES, icon: '🏆', label: 'Trophées' },
    { route: AppRoute.NEWSLETTER, icon: '📰', label: 'Newsletter' },
  ];

  return (
    <div className="fixed md:absolute bottom-0 left-0 right-0 md:left-auto md:right-auto w-full max-w-md mx-auto bg-white border-t-2 border-gray-200 flex items-center justify-around py-1 md:py-2 px-1.5 md:px-2 safe-area-bottom z-40">
      {tabs.map((tab) => (
        <button
          key={tab.route}
          onClick={() => setCurrentRoute(tab.route)}
          className={`relative flex flex-col items-center justify-center flex-1 py-1.5 md:py-2 px-1 rounded-lg transition-all duration-200 ${
            currentRoute === tab.route
              ? 'bg-purple-100'
              : 'hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <span className="text-xl md:text-2xl mb-0.5 md:mb-1">{tab.icon}</span>
          <span className={`text-[0.8rem] md:text-xs font-semibold leading-tight ${
            currentRoute === tab.route
              ? 'text-[#8B5CF6]'
              : 'text-gray-500'
          }`}>
            {tab.label}
          </span>
          {currentRoute === tab.route && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-10 md:w-12 h-1 bg-[#8B5CF6] rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
