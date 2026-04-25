import React, { useEffect } from 'react';
import { NavigationProvider, useNavigation } from './navigation/NavigationContext';
import { UserProgressProvider, useUserProgress } from './contexts/UserProgressContext';
import { AppRoute } from './types';
import TabBar from './components/TabBar';
import LearningPathScreen from './screens/LearningPathScreen';
import LeaguesScreen from './screens/LeaguesScreen';
import TrophiesScreen from './screens/TrophiesScreen';
import NewsletterScreen from './screens/NewsletterScreen';
import LessonScreen from './screens/LessonScreen';
import AuthModal from './components/AuthModal';

const ScreenContainer: React.FC = () => {
  const { currentRoute } = useNavigation();

  return (
    <main className="flex-1 w-full h-full overflow-hidden relative">
      {currentRoute === AppRoute.ACADEMY && <LearningPathScreen />}
      {currentRoute === AppRoute.LEAGUES && <LeaguesScreen />}
      {currentRoute === AppRoute.TROPHIES && <TrophiesScreen />}
      {currentRoute === AppRoute.NEWSLETTER && <NewsletterScreen />}
      {currentRoute === AppRoute.LESSON && <LessonScreen />}
    </main>
  );
};

const ConditionalTabBar: React.FC = () => {
  const { currentRoute } = useNavigation();
  if (currentRoute === AppRoute.LESSON) {
    return null;
  }
  return <TabBar />;
};

/**
 * Composant interne qui affiche AuthModal si l'utilisateur n'est pas authentifié.
 * Doit être à l'intérieur de UserProgressProvider pour accéder au contexte.
 */
const AppContent: React.FC = () => {
  const { isLoading, isAuthenticated, refreshAuth } = useUserProgress();

  // Affiche un loader pendant le chargement initial
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // Affiche le modal d'authentification si pas authentifié
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-gray-50">
        <AuthModal onAuthComplete={refreshAuth} />
      </div>
    );
  }

  // Affiche l'app normale si authentifié
  return (
    <NavigationProvider>
      <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative">
        <ScreenContainer />
        <ConditionalTabBar />
      </div>
    </NavigationProvider>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem('theme-preference');
    const shouldUseDark =
      storedTheme === 'dark' ||
      (!storedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark-theme', shouldUseDark);
  }, []);

  return (
    <UserProgressProvider>
      <AppContent />
    </UserProgressProvider>
  );
};

export default App;
