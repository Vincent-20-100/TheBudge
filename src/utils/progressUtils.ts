/**
 * Retourne les 7 jours de la semaine (Di L Ma Me J V S) avec leur état coché.
 * Coche les `streak` derniers jours consécutifs se terminant sur `lastLessonDate`.
 */
export function getWeekDays(lastLessonDate: string | null, streak: number): { label: string; checked: boolean }[] {
  const days = ['Di', 'L', 'Ma', 'Me', 'J', 'V', 'S'];
  const today = new Date();

  const checkedDates = new Set<string>();
  if (lastLessonDate && streak > 0) {
    const last = new Date(lastLessonDate + 'T12:00:00');
    for (let i = 0; i < streak; i++) {
      const d = new Date(last);
      d.setDate(last.getDate() - i);
      checkedDates.add(d.toISOString().split('T')[0]);
    }
  }

  return days.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (i === 0 ? -1 : i - 1));
    const dateStr = d.toISOString().split('T')[0];
    return { label, checked: checkedDates.has(dateStr) };
  });
}

/** Retourne le temps avant recharge complète de l'énergie. */
export function timeUntilFull(energy: number, maxEnergy: number, lastUpdated: string): string {
  if (energy >= maxEnergy) return 'Pleine';
  const missing = maxEnergy - energy;
  const minutesNeeded = missing * 30;
  const elapsed = (Date.now() - new Date(lastUpdated).getTime()) / 60000;
  const remaining = Math.max(0, minutesNeeded - (elapsed % 30));
  const totalRemaining = (missing - 1) * 30 + remaining;
  const h = Math.floor(totalRemaining / 60);
  const m = Math.floor(totalRemaining % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
