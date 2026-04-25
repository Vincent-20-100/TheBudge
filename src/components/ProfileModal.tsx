import React, { useEffect, useState } from 'react';
import { useUserProgress } from '../contexts/UserProgressContext';

interface ProfileModalProps {
  onClose: () => void;
}

function getInitials(name: string): string | null {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { progress, displayName, userEmail, resetProgress, signOut, updateDisplayName, overrideProgress } = useUserProgress();

  const [resetState, setResetState] = useState<'idle' | 'confirming'>('idle');
  const [nameInput, setNameInput] = useState(displayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devStreak, setDevStreak] = useState(0);
  const [devDiamonds, setDevDiamonds] = useState(0);
  const [devEnergy, setDevEnergy] = useState(0);
  const [devXpTotal, setDevXpTotal] = useState(0);
  const [devLeagueTier, setDevLeagueTier] = useState(1);
  const [devCurrentCapsule, setDevCurrentCapsule] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsDarkTheme(document.documentElement.classList.contains('dark-theme'));
  }, []);

  function toggleTheme() {
    if (typeof window === 'undefined') return;
    const next = !isDarkTheme;
    setIsDarkTheme(next);
    document.documentElement.classList.toggle('dark-theme', next);
    window.localStorage.setItem('theme-preference', next ? 'dark' : 'light');
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSignOut() {
    await signOut();
    onClose();
  }

  async function handleSaveName() {
    if (!nameInput.trim() || nameInput === displayName) return;
    await updateDisplayName(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function handleConfirmReset() {
    await resetProgress();
    setResetState('idle');
    setShowDevPanel(false);
    onClose();
  }

  function handleOpenDevPanel() {
    setDevStreak(progress.streak);
    setDevDiamonds(progress.diamonds);
    setDevEnergy(progress.energy);
    setDevXpTotal(progress.xpTotal);
    setDevLeagueTier(progress.leagueTier);
    setDevCurrentCapsule(progress.currentCapsule);
    setShowDevPanel(true);
  }

  function handleApplyDev() {
    overrideProgress({
      streak: devStreak,
      diamonds: devDiamonds,
      energy: devEnergy,
      xpTotal: devXpTotal,
      leagueTier: devLeagueTier,
      currentCapsule: devCurrentCapsule,
    });
    setShowDevPanel(false);
  }

  const initials = getInitials(displayName);
  const capsuleCount = progress.completedCapsules.length;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Mon compte</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-lg font-bold"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Avatar et identité */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white text-2xl font-bold select-none">
            {initials ? initials : <span>👤</span>}
          </div>
          {displayName && (
            <p className="text-lg font-bold text-gray-800 text-center">{displayName}</p>
          )}
          {userEmail && (
            <p className="text-sm text-gray-400 text-center">{userEmail}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-2xl p-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-gray-800">{progress.streak}</span>
            <span className="text-xs text-gray-500 text-center">🔥 Série</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-gray-800">{progress.diamonds}</span>
            <span className="text-xs text-gray-500 text-center">💎 Diamants</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-gray-800">{capsuleCount}</span>
            <span className="text-xs text-gray-500 text-center">📚 Capsules</span>
          </div>
        </div>

        {/* Paramètres */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Paramètres</h3>

          {/* Pseudo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Pseudo</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                className={`flex-1 px-4 py-2 border-2 border-gray-100 bg-gray-50 rounded-[2.5rem] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors ${
                  isDarkTheme ? 'text-white placeholder:text-slate-400' : 'text-gray-800 placeholder:text-gray-400'
                }`}
                placeholder="Votre pseudo"
              />
              <button
                onClick={handleSaveName}
                disabled={!nameInput.trim() || nameInput === displayName}
                className="px-4 py-2 bg-[#8B5CF6] text-white text-sm font-bold rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {nameSaved ? '✓' : 'OK'}
              </button>
            </div>
          </div>

          {/* Email — lecture seule */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Email</label>
            <div className="px-4 py-2 border-2 border-gray-100 rounded-[2.5rem] bg-gray-50 text-sm text-gray-400">
              {userEmail || '—'}
            </div>
          </div>

          {/* Langue */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Langue</label>
            <select
              disabled
              className="px-4 py-2 border-2 border-gray-100 rounded-[2.5rem] bg-gray-50 text-sm text-gray-400 cursor-not-allowed appearance-none"
            >
              <option>🇫🇷 Français</option>
            </select>
          </div>

          {/* Mode nuit */}
          <div className="flex items-center justify-between px-4 py-3 border-2 border-gray-100 rounded-[2.5rem] bg-gray-50">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800">Mode nuit</span>
              <span className="text-xs text-gray-500">
                {isDarkTheme ? 'Activé' : 'Désactivé'}
              </span>
            </div>
            <label className="switch" aria-label="Activer ou désactiver le mode nuit">
              <input
                type="checkbox"
                checked={isDarkTheme}
                onChange={toggleTheme}
              />
              <span className="slider" />
            </label>
          </div>
        </div>

        {/* Déconnexion */}
        <button
          onClick={handleSignOut}
          className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors"
        >
          Se déconnecter
        </button>

        {/* Panel développeur */}
        {!showDevPanel ? (
          <div className="flex justify-center">
            <button
              onClick={handleOpenDevPanel}
              className="text-xs text-gray-200 hover:text-gray-400 transition-colors"
            >
              ⚙ paramètres dev
            </button>
          </div>
        ) : (
          <div className={`flex flex-col gap-3 border border-dashed rounded-2xl p-4 ${isDarkTheme ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wide ${isDarkTheme ? 'text-gray-400' : 'text-gray-400'}`}>Paramètres développeur</span>
              <button onClick={() => setShowDevPanel(false)} className={`text-xs ${isDarkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-gray-300 hover:text-gray-500'}`}>✕</button>
            </div>

            {[
              { label: '🔥 Série', value: devStreak, set: setDevStreak, min: 0, max: 999 },
              { label: '💎 Diamants', value: devDiamonds, set: setDevDiamonds, min: 0, max: 99999 },
              { label: '⚡ Énergie', value: devEnergy, set: setDevEnergy, min: 0, max: progress.maxEnergy },
              { label: '⭐ XP total', value: devXpTotal, set: setDevXpTotal, min: 0, max: 999999 },
              { label: '🏆 Ligue (1–10)', value: devLeagueTier, set: setDevLeagueTier, min: 1, max: 10 },
              { label: '📚 Capsule actuelle', value: devCurrentCapsule, set: setDevCurrentCapsule, min: 1, max: 99 },
            ].map(({ label, value, set, min, max }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`text-xs w-36 flex-shrink-0 ${isDarkTheme ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={value}
                  onChange={e => set(Math.min(max, Math.max(min, Number(e.target.value))))}
                  className={`flex-1 px-3 py-1.5 border rounded-xl text-sm focus:outline-none focus:border-[#8B5CF6] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}
                />
              </div>
            ))}

            <button
              onClick={handleApplyDev}
              className="w-full py-2 bg-[#8B5CF6] text-white text-sm font-bold rounded-xl hover:bg-[#7C3AED] transition-colors"
            >
              Appliquer
            </button>

            <div className={`border-t pt-2 flex flex-col items-center gap-1 ${isDarkTheme ? 'border-gray-600' : 'border-gray-100'}`}>
              {resetState === 'idle' && (
                <button
                  onClick={() => setResetState('confirming')}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors underline underline-offset-2"
                >
                  Réinitialiser ma progression
                </button>
              )}
              {resetState === 'confirming' && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmReset}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors underline underline-offset-2 font-semibold"
                  >
                    Confirmer
                  </button>
                  <span className="text-gray-200">|</span>
                  <button
                    onClick={() => setResetState('idle')}
                    className="text-xs text-gray-300 hover:text-gray-500 transition-colors underline underline-offset-2"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
