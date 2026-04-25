import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppRoute } from '../types';

export interface LessonState {
  capsuleId: number;
  blocIndex: number;
}

interface NavigationContextType {
  currentRoute: AppRoute;
  setCurrentRoute: (route: AppRoute) => void;
  currentLesson: LessonState | null;
  setCurrentLesson: (lesson: LessonState | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.ACADEMY);
  const [currentLesson, setCurrentLesson] = useState<LessonState | null>(null);

  return (
    <NavigationContext.Provider value={{ currentRoute, setCurrentRoute, currentLesson, setCurrentLesson }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

