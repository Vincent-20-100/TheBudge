export enum AppRoute {
  ACADEMY = 'academy',
  LEAGUES = 'leagues',
  TROPHIES = 'trophies',
  NEWSLETTER = 'newsletter',
  LESSON = 'lesson'
}

export interface UserProgress {
  streak: number;
  diamonds: number;
  energy: number;
  maxEnergy: number;
  completedCapsules: number[];
  currentCapsule: number;
  claimedChests: number[];
  leagueTier: number;
  xpTotal: number;
  lastLessonDate: string | null;  // 'YYYY-MM-DD'
  energyLastUpdated: string;      // ISO timestamp
  maxStreak: number;
  perfectLessons: number;
  maxDailyXp: number;
  maxLeagueTier: number;
  dailyXp: number;
  dailyXpDate: string | null;     // 'YYYY-MM-DD'
}

