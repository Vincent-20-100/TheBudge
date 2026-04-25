import React, { useState } from 'react';
import { useUserProgress } from '../contexts/UserProgressContext';
import ProfileModal from './ProfileModal';

interface HeaderProps {
  streak: number;
  diamonds: number;
  energy: number;
  maxEnergy: number;
  onStreakClick?: () => void;
  onDiamondsClick?: () => void;
  onEnergyClick?: () => void;
  onBoostClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  streak,
  diamonds,
  energy,
  maxEnergy,
  onStreakClick,
  onDiamondsClick,
  onEnergyClick,
  onBoostClick
}) => {
  const { displayName } = useUserProgress();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const energyPercentage = (energy / maxEnergy) * 100;

  // Extrait les deux premières initiales du nom pour l'avatar
  const initials = displayName
    ? displayName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : null;

  return (
    <>
    <div className="w-full bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#8B5CF6] px-3 md:px-4 pt-2 md:pt-3 pb-1.5 md:pb-2 flex items-center justify-between border-b border-white/15 shadow-md">
      {/* Left side - Avatar utilisateur */}
      <button
        onClick={() => setShowProfileModal(true)}
        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/20 border-2 border-white flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95"
        aria-label="Mon compte"
      >
        {initials
          ? <span className="text-white font-bold text-[11px] md:text-xs">{initials}</span>
          : <span className="text-white text-base md:text-lg">👤</span>
        }
      </button>

      {/* Center - Stats */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Streak */}
        <button
          onClick={onStreakClick}
          className="h-8 md:h-9 flex items-center gap-1 md:gap-1.5 bg-white/20 rounded-full px-2.5 md:px-3 backdrop-blur-[2px] hover:bg-white/30 transition-colors active:scale-95"
        >
          <span className="text-base md:text-lg">🔥</span>
          <span className="text-white font-extrabold text-xs md:text-sm leading-none">{streak}</span>
        </button>

        {/* Diamonds */}
        <button
          onClick={onDiamondsClick}
          className="h-8 md:h-9 flex items-center gap-1 md:gap-1.5 bg-white/20 rounded-full px-2.5 md:px-3 backdrop-blur-[2px] hover:bg-white/30 transition-colors active:scale-95"
        >
          <span className="text-base md:text-lg">💎</span>
          <span className="text-white font-extrabold text-xs md:text-sm leading-none">{diamonds}</span>
        </button>

        {/* Energy */}
        <button
          onClick={onEnergyClick}
          className="h-8 md:h-9 min-w-[68px] md:min-w-[74px] bg-white/20 rounded-full px-2 md:px-2.5 backdrop-blur-[2px] hover:bg-white/30 transition-colors active:scale-95 flex flex-col justify-center"
        >
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs md:text-sm">🔋</span>
            <span className="text-white font-extrabold text-[11px] md:text-xs leading-none">{energy}/{maxEnergy}</span>
          </div>
          <div className="mt-1 h-1 md:h-1.5 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, energyPercentage))}%` }}
            />
          </div>
        </button>
      </div>

      {/* Right side - BOOST button */}
      <button 
        onClick={onBoostClick}
        className="h-8 md:h-9 px-3 md:px-4 rounded-xl font-extrabold text-white text-xs md:text-sm tracking-wide hover:opacity-90 transition-opacity active:scale-95 shadow-lg shadow-purple-900/30"
        style={{ background: 'linear-gradient(to right, #10B981, #8B5CF6, #EC4899)' }}
      >
        BOOST
      </button>
    </div>
    {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </>
  );
};

export default Header;
