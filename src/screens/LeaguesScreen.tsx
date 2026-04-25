import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import { useUserProgress } from '../contexts/UserProgressContext';
import { supabase } from '../services/supabaseClient';
import {
  LeagueStanding,
  getCurrentWeekStart,
  getOrJoinGroup,
  fetchLeaderboard,
  subscribeToGroup,
  resolveWeekEnd,
  padWithBots,
} from '../services/LeaguesService';

const LEAGUES = [
  { id: 1,  name: 'Bronze',     color: '#CD7F32', icon: '🥉' },
  { id: 2,  name: 'Argent',     color: '#C0C0C0', icon: '🥈' },
  { id: 3,  name: 'Or',         color: '#FFD700', icon: '🥇' },
  { id: 4,  name: 'Saphire',    color: '#0F52BA', icon: '🔵' },
  { id: 5,  name: 'Rubis',      color: '#E0115F', icon: '🔴' },
  { id: 6,  name: 'Émeraude',   color: '#50C878', icon: '🟢' },
  { id: 7,  name: 'Améthyste',  color: '#8B5CF6', icon: '🟣' },
  { id: 8,  name: 'Perle',      color: '#F8F8FF', icon: '⚪' },
  { id: 9,  name: 'Obsidienne', color: '#2C2C2C', icon: '⚫' },
  { id: 10, name: 'Diamant',    color: '#B9F2FF', icon: '💎' },
];

const TOP_ADVANCE = 5;
const BOTTOM_DEMOTE = 3;

/** Initiales depuis un nom affiché. */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

import { getWeekDays, timeUntilFull } from '../utils/progressUtils';

const LeaguesScreen: React.FC = () => {
  const { progress, displayName } = useUserProgress();
  const { streak, diamonds, energy, maxEnergy, leagueTier, lastLessonDate, energyLastUpdated } = progress;

  const [isDarkTheme, setIsDarkTheme] = useState(
    () => typeof window !== 'undefined' && document.documentElement.classList.contains('dark-theme')
  );
  const [showStreakModal, setShowStreakModal]         = useState(false);
  const [showDiamondsModal, setShowDiamondsModal]     = useState(false);
  const [showEnergyModal, setShowEnergyModal]         = useState(false);
  const [showBoostModal, setShowBoostModal]           = useState(false);
  const [showBoostPromoModal, setShowBoostPromoModal] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeagueStanding[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const weekStart = getCurrentWeekStart();
  const currentLeague = LEAGUES.find(l => l.id === leagueTier) ?? LEAGUES[0];

  // Calcule les jours restants dans la semaine (lundi = jour 1)
  const daysRemaining = 7 - ((new Date().getDay() + 6) % 7) - 1;

  const initLeagues = useCallback(async () => {
    const effectiveDisplayName = displayName || 'Joueur';
    console.log('[Leagues] init — displayName:', displayName, 'leagueTier:', leagueTier);
    setIsLoadingBoard(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      console.log('[Leagues] session uid:', uid ?? 'null');
      if (!uid) { setIsLoadingBoard(false); return; }
      setCurrentUserId(uid);

      const newTier = await resolveWeekEnd(uid, weekStart);
      console.log('[Leagues] resolveWeekEnd:', newTier);
      const effectiveTier = newTier ?? leagueTier;

      const gid = await getOrJoinGroup(uid, effectiveTier, weekStart, effectiveDisplayName);
      console.log('[Leagues] getOrJoinGroup gid:', gid ?? 'null');

      if (gid) {
        setGroupId(gid);
        const board = await fetchLeaderboard(gid, weekStart);
        console.log('[Leagues] fetchLeaderboard rows:', board.length);
        setLeaderboard(padWithBots(board, gid, weekStart));
      }
    } catch (err) {
      console.error('[Leagues] initLeagues exception:', err);
    } finally {
      setIsLoadingBoard(false);
    }
  }, [leagueTier, weekStart, displayName]);

  useEffect(() => {
    initLeagues();
  }, [initLeagues]);

  useEffect(() => {
    if (!groupId) return;
    const unsubscribe = subscribeToGroup(
      groupId,
      weekStart,
      (fresh) => setLeaderboard(padWithBots(fresh, groupId, weekStart))
    );
    return unsubscribe;
  }, [groupId, weekStart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains('dark-theme'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`flex flex-col h-full w-full ${isDarkTheme ? 'bg-[#0B1220]' : 'bg-white'}`}>
      <Header
        streak={streak}
        diamonds={diamonds}
        energy={energy}
        maxEnergy={maxEnergy}
        onStreakClick={() => setShowStreakModal(true)}
        onDiamondsClick={() => setShowDiamondsModal(true)}
        onEnergyClick={() => setShowEnergyModal(true)}
        onBoostClick={() => setShowBoostModal(true)}
      />

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* League badges */}
        <div className={`px-4 py-6 ${isDarkTheme ? 'bg-[#0B1220]' : 'bg-white'}`}>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {LEAGUES.map((league) => {
              const locked = league.id > leagueTier;
              const current = league.id === leagueTier;
              return (
                <div key={league.id} className={`relative flex flex-col items-center ${locked ? 'opacity-50' : ''}`}>
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-4 ${
                      current ? 'border-yellow-400 scale-110' : locked ? 'border-gray-300 bg-gray-200' : isDarkTheme ? 'border-gray-600' : 'border-white'
                    }`}
                    style={{ backgroundColor: locked ? '#E5E7EB' : league.color }}
                  >
                    <span className="text-2xl">{league.icon}</span>
                  </div>
                  {locked && (
                    <span className="text-xl absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">🔒</span>
                  )}
                  <p className={`text-xs font-semibold mt-1 ${current ? 'text-[#8B5CF6]' : isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                    {league.name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current League Info */}
        <div className={`px-4 pb-4 ${isDarkTheme ? 'bg-[#0B1220]' : 'bg-white'}`}>
          <h1 className={`text-2xl font-bold mb-1 text-center ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Ligue {currentLeague.name}</h1>
          <p className={`text-sm text-center mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Les {TOP_ADVANCE} premiers passent à la ligue supérieure</p>
          <p className="text-sm font-semibold text-[#8B5CF6] text-center">{daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}</p>
        </div>

        {/* Leaderboard — mode nuit : fond sombre + texte blanc pour tous les blocs (même style) */}
        <div className={`px-4 pb-6 ${isDarkTheme ? 'bg-[#0B1220]' : ''}`}>
          {isLoadingBoard ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-16 rounded-[2.5rem] animate-pulse ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-100'}`} />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className={`text-center text-sm py-8 ${isDarkTheme ? 'text-gray-400' : 'text-gray-400'}`}>Classement en cours de chargement…</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => {
                const rank = idx + 1;
                const isCurrentUser = entry.userId === currentUserId;
                const isPromoZone = rank <= TOP_ADVANCE;
                const isDemoteZone = rank > leaderboard.length - BOTTOM_DEMOTE;
                const rowBg = isDarkTheme
                  ? (isCurrentUser ? 'bg-[#1e1b4b] border-2 border-[#8B5CF6]' : 'bg-[#111827] border border-gray-600')
                  : (isCurrentUser
                      ? 'bg-purple-50 border-2 border-[#8B5CF6]'
                      : isPromoZone
                      ? 'bg-green-50 border border-green-200'
                      : isDemoteZone
                      ? 'bg-red-50 border border-red-100'
                      : 'bg-white border border-gray-200');
                const rankColor = isDarkTheme
                  ? (isCurrentUser ? 'text-[#A78BFA]' : 'text-gray-300')
                  : (isCurrentUser ? 'text-[#8B5CF6]' : 'text-gray-600');
                const nameColor = isDarkTheme
                  ? (isCurrentUser ? 'text-[#A78BFA]' : 'text-white')
                  : (isCurrentUser ? 'text-[#8B5CF6]' : 'text-gray-900');
                const xpColor = isDarkTheme
                  ? (isCurrentUser ? 'text-[#A78BFA]' : 'text-gray-300')
                  : (isCurrentUser ? 'text-[#8B5CF6]' : 'text-gray-500');
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-3 p-3 rounded-[2.5rem] ${rowBg}`}
                  >
                    <div className="flex-shrink-0 w-8 text-center">
                      {rank === 1 ? <span className="text-2xl">🥇</span>
                        : rank === 2 ? <span className="text-2xl">🥈</span>
                        : rank === 3 ? <span className="text-2xl">🥉</span>
                        : <span className={`text-lg font-bold ${rankColor}`}>{rank}</span>}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {getInitials(entry.displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${nameColor}`}>
                        {entry.displayName}
                      </p>
                      <p className={`text-xs ${xpColor}`}>
                        {entry.xpThisWeek} XP
                      </p>
                    </div>
                    {isPromoZone && <span className={`text-xs font-semibold ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`}>↑</span>}
                    {isDemoteZone && <span className={`text-xs font-semibold ${isDarkTheme ? 'text-red-400' : 'text-red-400'}`}>↓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Streak */}
      {showStreakModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowStreakModal(false)}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-5xl font-bold text-white">{streak}</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">Streak</h3>
            <p className="text-sm text-gray-600 text-center mb-4">Complétez une leçon chaque jour pour maintenir votre streak.</p>
            <div className="flex justify-between items-center mb-4">
              {getWeekDays(lastLessonDate, streak).map(({ label, checked }, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{label}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checked ? 'bg-orange-500' : 'bg-gray-300'}`}>
                    <span className={`text-xs ${checked ? 'text-white' : 'text-gray-500'}`}>{checked ? '✓' : '✗'}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowStreakModal(false)} className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors">Fermer</button>
          </div>
        </div>
      )}

      {/* Modal Diamonds */}
      {showDiamondsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowDiamondsModal(false)}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <span className="text-5xl">💎</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-1">Diamants</h3>
            <p className="text-center mb-4"><span className="text-2xl font-extrabold text-[#8B5CF6]">{diamonds}</span><span className="text-sm text-gray-600 ml-1">diamants</span></p>
            <p className="text-sm text-gray-600 text-center mb-4">Les diamants peuvent être dépensés pour :</p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700"><span>🔋</span><span>Recharger votre énergie</span></div>
              <div className="flex items-center gap-2 text-sm text-gray-700"><span>⭐</span><span>Accéder à des leçons spéciales et légendaires</span></div>
              <div className="flex items-center gap-2 text-sm text-gray-700"><span>🎨</span><span>Personnaliser votre avatar (fonctionnalité à venir)</span></div>
            </div>
            <button onClick={() => setShowDiamondsModal(false)} className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors">Fermer</button>
          </div>
        </div>
      )}

      {/* Modal Énergie */}
      {showEnergyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowEnergyModal(false)}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Énergie</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>🕐</span>
                <span>PLEINE DANS {timeUntilFull(energy, maxEnergy, energyLastUpdated).toUpperCase()}</span>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{energy}/{maxEnergy}</span>
                <span className="text-lg">⚡</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A7F3D0] transition-all duration-300" style={{ width: `${(energy / maxEnergy) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <button
                onClick={() => { setShowEnergyModal(false); setShowBoostPromoModal(true); }}
                className="w-full rounded-[2.5rem] p-4 text-white text-left hover:opacity-90 transition-opacity active:scale-95"
                style={{ background: 'linear-gradient(to right, #10B981, #8B5CF6, #EC4899)' }}
              >
                <div className="flex items-center justify-between">
                  <div><p className="font-bold text-sm mb-1 text-white">BOOST</p><div className="flex items-center gap-2"><span className="text-2xl">∞</span><span className="text-sm">Énergie illimitée</span></div></div>
                  <span className="bg-pink-500 px-3 py-1 rounded-full text-xs font-bold">ESSAI GRATUIT</span>
                </div>
              </button>
              <div className="bg-gray-100 rounded-[2.5rem] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-2xl">🔋</span><div><p className="font-semibold text-gray-900">Recharge</p><p className="text-xs text-gray-500">+25 énergie</p></div></div>
                  <div className="flex items-center gap-2"><span className="text-xl">💎</span><span className="font-bold text-gray-900">500</span></div>
                </div>
              </div>
              <div className="bg-gray-100 rounded-[2.5rem] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-2xl">🔋</span><div><p className="font-semibold text-gray-900">Mini charge</p><p className="text-xs text-gray-500">+3 énergie</p></div></div>
                  <span className="text-blue-500 font-bold text-sm">REGARDER PUB</span>
                </div>
              </div>
            </div>
            <button onClick={() => setShowEnergyModal(false)} className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors">Fermer</button>
          </div>
        </div>
      )}

      {/* Boost Promo Modal */}
      {showBoostPromoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowBoostPromoModal(false)}>
          <div className="bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute top-4 right-4 bg-green-500 rounded-lg px-3 py-1 border-2 border-green-400">
              <p className="text-white font-bold text-xs">BOOST</p>
            </div>
            <div className="flex justify-center mb-4 relative z-10">
              <div className="w-32 h-32 rounded-full bg-gradient-to-b from-green-400 via-purple-500 to-blue-500 flex items-center justify-center relative overflow-hidden">
                <img src="bear_assets/mascot-bear.png" alt="Mascot Bear" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="absolute -top-2 -left-2 text-2xl animate-pulse">✨</span>
                <span className="absolute -top-2 -right-2 text-2xl animate-pulse" style={{ animationDelay: '0.2s' }}>✨</span>
                <span className="absolute -bottom-2 -left-2 text-2xl animate-pulse" style={{ animationDelay: '0.4s' }}>✨</span>
                <span className="absolute -bottom-2 -right-2 text-2xl animate-pulse" style={{ animationDelay: '0.6s' }}>✨</span>
              </div>
            </div>
            <div className="text-center mb-6 relative z-10">
              <p className="text-white text-base leading-relaxed">
                Les apprenants <span className="font-bold text-green-400">BOOST</span> ont <span className="font-bold text-green-400">4,2x</span> plus de chances de terminer le cours de finance !
              </p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-[2.5rem] p-4 mb-6 relative z-10">
              <div className="space-y-4">
                {[
                  { icon: '∞', title: 'Énergie illimitée', desc: 'Apprenez à votre rythme sans jamais manquer d\'énergie' },
                  { icon: '💪', title: 'Pratique personnalisée', desc: 'Un plan d\'entraînement hebdomadaire pour cibler vos points faibles en finance' },
                  { icon: '🎯', title: 'Prouvez vos connaissances', desc: 'Démontrez votre maîtrise avec des certifications' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xl">{icon}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">{title}</p>
                      <p className="text-gray-300 text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative z-10">
              <button onClick={() => setShowBoostPromoModal(false)} className="w-full bg-white text-gray-900 font-bold py-4 rounded-[2.5rem] hover:bg-gray-100 transition-colors mb-3 shadow-lg">ESSAYER GRATUITEMENT</button>
              <button onClick={() => setShowBoostPromoModal(false)} className="w-full text-white text-sm font-semibold py-2">NON MERCI</button>
            </div>
          </div>
        </div>
      )}

      {/* Boost Modal - Plans d'abonnement */}
      {showBoostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowBoostModal(false)}>
          <div className="bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-white text-center mb-6">Choisissez un plan</h3>
            <div className="space-y-3 mb-4">
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div><p className="text-lg font-bold">Plan Familial</p><p className="text-sm text-gray-300">12 mois • 108,99 €</p></div>
                  <p className="text-lg font-bold">8,99 € / MO</p>
                </div>
              </div>
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white relative">
                <div className="absolute top-2 left-2 bg-green-500 rounded-lg px-2 py-1"><p className="text-xs font-bold text-white">LE PLUS POPULAIRE</p></div>
                <div className="flex items-center justify-between mt-4">
                  <div><p className="text-lg font-bold">Individuel</p><p className="text-sm text-gray-300">12 mois • 76,99 €</p></div>
                  <p className="text-lg font-bold">5,99 € / MO</p>
                </div>
              </div>
              <div className="text-center text-white text-xs mb-2"><p>ESSAI GRATUIT DE 7 JOURS</p><div className="w-full h-px bg-gray-500 my-2" /></div>
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div><p className="text-lg font-bold">Mensuel</p></div>
                  <p className="text-lg font-bold">11,99 € / MO</p>
                </div>
              </div>
              <div className="text-center text-white text-xs mb-2"><p>PAS D'ESSAI GRATUIT</p><div className="w-full h-px bg-gray-500 my-2" /></div>
              <div className="rounded-[2.5rem] p-4 text-white relative border-2 border-purple-400" style={{ background: 'linear-gradient(to right, #10B981, #8B5CF6)' }}>
                <div className="absolute top-2 left-2 bg-green-500 rounded-lg px-2 py-1"><p className="text-xs font-bold text-white">50% DE RÉDUCTION</p></div>
                <div className="absolute top-2 right-2 text-blue-400 text-xl">✓</div>
                <div className="flex items-center justify-between mt-4">
                  <div><p className="text-lg font-bold">Plan Étudiant</p><p className="text-sm text-gray-200">12 mois • 34,99 €</p><p className="text-xs text-gray-300 mt-1">Le statut étudiant doit être vérifié</p></div>
                  <p className="text-lg font-bold">2,99 € / MO</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mb-4">Annulez à tout moment dans l'App Store</p>
            <button onClick={() => setShowBoostModal(false)} className="w-full bg-white text-gray-900 font-bold py-4 rounded-[2.5rem] hover:bg-gray-100 transition-colors mb-3">OBTENIR BOOST</button>
            <button onClick={() => setShowBoostModal(false)} className="w-full text-white text-sm font-semibold py-2">NON MERCI</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaguesScreen;
