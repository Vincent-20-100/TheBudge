import React, { useState } from 'react';
import { useUserProgress } from '../contexts/UserProgressContext';
import { getWeekDays, timeUntilFull } from '../utils/progressUtils';
import Header from '../components/Header';

interface PersonalRecord {
  id: number;
  title: string;
  value: string;
  date: string;
  icon: string;
  color: string;
  emoji: string;
  description: string;
  subtitle?: string;
}

interface Trophy {
  id: number;
  name: string;
  emoji: string;
  description: string;
  progress: string;
  level: number;
  color: string;
}

const TrophiesScreen: React.FC = () => {
  const [selectedTrophy, setSelectedTrophy] = useState<Trophy | null>(null);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showDiamondsModal, setShowDiamondsModal] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showBoostPromoModal, setShowBoostPromoModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PersonalRecord | null>(null);
  const { progress } = useUserProgress();
  const { streak, diamonds, energy, maxEnergy, lastLessonDate, energyLastUpdated,
          maxStreak, perfectLessons, maxDailyXp, maxLeagueTier } = progress;

  const LEAGUES = [
    { id: 1, name: 'Bronze' }, { id: 2, name: 'Argent' }, { id: 3, name: 'Or' },
    { id: 4, name: 'Saphire' }, { id: 5, name: 'Rubis' }, { id: 6, name: 'Émeraude' },
    { id: 7, name: 'Améthyste' }, { id: 8, name: 'Perle' }, { id: 9, name: 'Obsidienne' },
    { id: 10, name: 'Diamant' },
  ];
  const maxLeagueName = LEAGUES.find(l => l.id === maxLeagueTier)?.name ?? 'Bronze';

  const personalRecords: PersonalRecord[] = [
    {
      id: 1,
      title: 'Streak Maximal',
      value: String(maxStreak),
      date: maxStreak > 0 ? 'Record personnel' : 'Aucun record',
      icon: '🔥',
      color: 'from-orange-400 to-orange-600',
      emoji: '🔥',
      description: 'Votre record de jours consécutifs d\'apprentissage. Maintenez votre streak en complétant au moins une leçon chaque jour !'
    },
    {
      id: 2,
      title: 'Leçons Parfaites',
      value: String(perfectLessons),
      date: perfectLessons > 0 ? 'Sans aucune erreur' : 'Aucune encore',
      icon: '✨',
      color: 'from-green-400 to-green-600',
      emoji: '✨',
      description: 'Nombre total de leçons complétées sans aucune erreur. La perfection demande de la pratique !'
    },
    {
      id: 3,
      title: 'XP Maximal (1 jour)',
      value: String(maxDailyXp),
      date: maxDailyXp > 0 ? 'Meilleure journée' : 'Aucun XP encore',
      icon: '⚡',
      color: 'from-yellow-400 to-yellow-600',
      emoji: '⚡',
      description: 'Le plus grand nombre de points d\'expérience gagnés en une seule journée. Montrez votre détermination !'
    },
    {
      id: 4,
      title: 'Ligue la plus haute',
      value: maxLeagueName,
      date: 'Meilleure ligue atteinte',
      icon: '💎',
      color: 'from-purple-400 to-purple-600',
      emoji: '💎',
      description: 'La ligue la plus élevée que vous avez atteinte. Continuez à progresser !'
    }
  ];

  const trophies: Trophy[] = [
    {
      id: 1,
      name: 'Explorateur',
      emoji: '🗺️',
      description: 'Complétez 5 quêtes différentes pour débloquer ce trophée. Explorez tous les aspects de l\'apprentissage financier !',
      progress: '0/5',
      level: 5,
      color: 'from-amber-600 to-amber-800'
    },
    {
      id: 2,
      name: 'Mécanicien',
      emoji: '🔧',
      description: 'Corrigez 5 erreurs dans vos leçons. Apprenez de vos erreurs pour devenir un expert !',
      progress: '0/5',
      level: 5,
      color: 'from-yellow-400 to-yellow-600'
    },
    {
      id: 3,
      name: 'Champion',
      emoji: '👑',
      description: 'Terminez 2 leçons avec un score parfait. La perfection est à portée de main !',
      progress: '0/5',
      level: 2,
      color: 'from-purple-400 to-purple-600'
    },
    {
      id: 4,
      name: 'Lève-tôt',
      emoji: '🌅',
      description: 'Complétez 5 leçons avant 8h du matin. Les lève-tôt sont récompensés !',
      progress: '0/5',
      level: 5,
      color: 'from-orange-300 to-orange-500'
    },
    {
      id: 5,
      name: 'Couche-tard',
      emoji: '🌙',
      description: 'Complétez 5 leçons. Les noctambules aussi méritent des récompenses !',
      progress: '0/5',
      level: 5,
      color: 'from-indigo-600 to-indigo-800'
    },
    {
      id: 6,
      name: 'Challenger',
      emoji: '⚔️',
      description: 'Participez à 5 défis hebdomadaires. Relevez tous les défis !',
      progress: '0/5',
      level: 5,
      color: 'from-red-400 to-red-600'
    },
    {
      id: 7,
      name: 'Légendaire',
      emoji: '🌟',
      description: 'Atteignez un streak de 7 jours. Devenez une légende de l\'apprentissage !',
      progress: '0/5',
      level: 7,
      color: 'from-yellow-300 to-yellow-500'
    },
    {
      id: 8,
      name: 'Tireur d\'Elite',
      emoji: '🎯',
      description: 'Obtenez 50 scores parfaits consécutifs. La précision est votre force !',
      progress: '0/5',
      level: 50,
      color: 'from-blue-400 to-blue-600'
    }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-white">
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
        {/* Personal Records Section */}
        <div className="px-4 py-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Records Personnels</h2>
          <div className="grid grid-cols-2 gap-3">
            {personalRecords.map((record) => (
              <button
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="bg-white rounded-[2.5rem] shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow active:scale-95"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${record.color} flex items-center justify-center mx-auto mb-2`}>
                  <span className="text-3xl">{record.emoji}</span>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 mb-1">{record.value}</p>
                  <p className="text-xs font-semibold text-gray-700 mb-1">{record.title}</p>
                  {record.subtitle && (
                    <p className="text-xs text-gray-500 mb-1">{record.subtitle}</p>
                  )}
                  <p className="text-xs text-gray-400">{record.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trophies Section */}
        <div className="px-4 pb-24 md:pb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Trophées</h2>
          <div className="grid grid-cols-3 gap-4">
            {trophies.map((trophy) => (
              <button
                key={trophy.id}
                onClick={() => setSelectedTrophy(trophy)}
                className="bg-white rounded-[2.5rem] shadow-md border border-gray-200 p-3 hover:shadow-lg transition-shadow active:scale-95"
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${trophy.color} flex items-center justify-center mx-auto mb-2`}>
                  <span className="text-4xl">{trophy.emoji}</span>
                </div>
                <p className="text-xs font-semibold text-gray-800 text-center mb-1">{trophy.name}</p>
                <p className="text-xs text-gray-500 text-center">{trophy.progress}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Record Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${selectedRecord.color} flex items-center justify-center`}>
                <span className="text-5xl">{selectedRecord.emoji}</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {selectedRecord.title}
            </h3>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-gray-900 mb-1">{selectedRecord.value}</p>
              {selectedRecord.subtitle && (
                <p className="text-sm text-gray-600 mb-1">{selectedRecord.subtitle}</p>
              )}
              <p className="text-xs text-gray-400">{selectedRecord.date}</p>
            </div>
            <p className="text-sm text-gray-600 text-center mb-4">
              {selectedRecord.description}
            </p>
            <button
              onClick={() => setSelectedRecord(null)}
              className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Trophy Modal */}
      {selectedTrophy && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTrophy(null)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${selectedTrophy.color} flex items-center justify-center`}>
                <span className="text-6xl">{selectedTrophy.emoji}</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {selectedTrophy.name}
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              {selectedTrophy.description}
            </p>
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">Niveau requis</span>
                <span className="text-sm font-bold text-gray-900">{selectedTrophy.level}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Progression</span>
                <span className="text-sm font-semibold text-[#8B5CF6]">{selectedTrophy.progress}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedTrophy(null)}
              className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Header Modals - Same as LearningPathScreen */}
      {showStreakModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowStreakModal(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-5xl font-bold text-white">{streak}</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Streak
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Complétez une leçon chaque jour pour maintenir votre streak.
            </p>
            <div className="flex justify-between items-center mb-4">
              {getWeekDays(lastLessonDate, streak).map(({ label: day, checked: isChecked }, index) => {
                return (
                  <div key={index} className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{day}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isChecked ? 'bg-orange-500' : 'bg-gray-300'
                    }`}>
                      {isChecked ? (
                        <span className="text-white text-xs">✓</span>
                      ) : (
                        <span className="text-gray-500 text-xs">✗</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowStreakModal(false)}
              className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showDiamondsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDiamondsModal(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <span className="text-5xl">💎</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-1">Diamants</h3>
            <p className="text-center mb-4"><span className="text-2xl font-extrabold text-[#8B5CF6]">{diamonds}</span><span className="text-sm text-gray-600 ml-1">diamants</span></p>
            <p className="text-sm text-gray-600 text-center mb-4">Les diamants peuvent être dépensés pour :</p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>🔋</span>
                <span>Recharger votre énergie</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>⭐</span>
                <span>Accéder à des leçons spéciales et légendaires</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>🎨</span>
                <span>Personnaliser votre avatar (fonctionnalité à venir)</span>
              </div>
            </div>
            <button
              onClick={() => setShowDiamondsModal(false)}
              className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showEnergyModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEnergyModal(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
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
                <div 
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A7F3D0] transition-all duration-300"
                  style={{ width: `${(energy / maxEnergy) * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <button
                onClick={() => {
                  setShowEnergyModal(false);
                  setShowBoostPromoModal(true);
                }}
                className="w-full rounded-[2.5rem] p-4 text-white text-left hover:opacity-90 transition-opacity" 
                style={{ background: 'linear-gradient(to right, #10B981, #8B5CF6, #EC4899)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm mb-1 text-white">BOOST</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">∞</span>
                      <span className="text-sm">Énergie illimitée</span>
                    </div>
                  </div>
                  <span className="bg-pink-500 px-3 py-1 rounded-full text-xs font-bold">ESSAI GRATUIT</span>
                </div>
              </button>
              <div className="bg-gray-100 rounded-[2.5rem] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔋</span>
                    <div>
                      <p className="font-semibold text-gray-900">Recharge</p>
                      <p className="text-xs text-gray-500">+25 énergie</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💎</span>
                    <span className="font-bold text-gray-900">500</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-100 rounded-[2.5rem] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔋</span>
                    <div>
                      <p className="font-semibold text-gray-900">Mini charge</p>
                      <p className="text-xs text-gray-500">+3 énergie</p>
                    </div>
                  </div>
                  <span className="text-blue-500 font-bold text-sm">REGARDER PUB</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEnergyModal(false)}
              className="w-full bg-[#8B5CF6] text-white font-bold py-3 rounded-[2.5rem] hover:bg-[#7C3AED] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Boost Modal */}
      {showBoostModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBoostModal(false)}
        >
          <div
            className="bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-white text-center mb-6">Choisissez un plan</h3>
            
            <div className="space-y-3 mb-4">
              {/* Plan Familial */}
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">Plan Familial</p>
                    <p className="text-sm text-gray-300">12 mois • 108,99 €</p>
                  </div>
                  <p className="text-lg font-bold">8,99 € / MO</p>
                </div>
              </div>

              {/* Plan Individuel */}
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white relative">
                <div className="absolute top-2 left-2 bg-green-500 rounded-lg px-2 py-1">
                  <p className="text-xs font-bold text-white">LE PLUS POPULAIRE</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-lg font-bold">Individuel</p>
                    <p className="text-sm text-gray-300">12 mois • 76,99 €</p>
                  </div>
                  <p className="text-lg font-bold">5,99 € / MO</p>
                </div>
              </div>
              <div className="text-center text-white text-xs mb-2">
                <p>ESSAI GRATUIT DE 7 JOURS</p>
                <div className="w-full h-px bg-gray-500 my-2"></div>
              </div>

              {/* Plan Mensuel */}
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">Mensuel</p>
                  </div>
                  <p className="text-lg font-bold">11,99 € / MO</p>
                </div>
              </div>
              <div className="text-center text-white text-xs mb-2">
                <p>PAS D'ESSAI GRATUIT</p>
                <div className="w-full h-px bg-gray-500 my-2"></div>
              </div>

              {/* Plan Étudiant */}
              <div className="rounded-[2.5rem] p-4 text-white relative border-2 border-purple-400" style={{ background: 'linear-gradient(to right, #10B981, #8B5CF6)' }}>
                <div className="absolute top-2 left-2 bg-green-500 rounded-lg px-2 py-1">
                  <p className="text-xs font-bold text-white">50% DE RÉDUCTION</p>
                </div>
                <div className="absolute top-2 right-2 text-blue-400 text-xl">✓</div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-lg font-bold">Plan Étudiant</p>
                    <p className="text-sm text-gray-200">12 mois • 34,99 €</p>
                    <p className="text-xs text-gray-300 mt-1">Le statut étudiant doit être vérifié</p>
                  </div>
                  <p className="text-lg font-bold">2,99 € / MO</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mb-4">Annulez à tout moment dans l'App Store</p>
            
            <button
              onClick={() => setShowBoostModal(false)}
              className="w-full bg-white text-gray-900 font-bold py-4 rounded-[2.5rem] hover:bg-gray-100 transition-colors mb-3"
            >
              OBTENIR BOOST
            </button>
            
            <button
              onClick={() => setShowBoostModal(false)}
              className="w-full text-white text-sm font-semibold py-2"
            >
              NON MERCI
            </button>
          </div>
        </div>
      )}

      {/* Boost Promo Modal */}
      {showBoostPromoModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBoostPromoModal(false)}
        >
          <div
            className="bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="absolute top-4 right-4 bg-green-500 rounded-lg px-3 py-1 border-2 border-green-400">
              <p className="text-white font-bold text-xs">BOOST</p>
            </div>

            <div className="flex justify-center mb-4 relative z-10">
              <div className="w-32 h-32 rounded-full bg-gradient-to-b from-green-400 via-purple-500 to-blue-500 flex items-center justify-center relative overflow-hidden">
                <img 
                  src="bear_assets/mascot-bear.png" 
                  alt="Mascot Bear"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.className = 'text-6xl';
                    fallback.textContent = '🐻';
                    e.currentTarget.parentElement?.appendChild(fallback);
                  }}
                />
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
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">∞</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Énergie illimitée</p>
                    <p className="text-gray-300 text-sm">Apprenez à votre rythme sans jamais manquer d'énergie</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">💪</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Pratique personnalisée</p>
                    <p className="text-gray-300 text-sm">Un plan d'entraînement hebdomadaire pour cibler vos points faibles en finance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">🎯</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Leçons légendaires</p>
                    <p className="text-gray-300 text-sm">Accédez à des contenus exclusifs et avancés</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowBoostPromoModal(false);
                setShowBoostModal(true);
              }}
              className="w-full bg-gradient-to-r from-green-400 via-purple-500 to-pink-500 text-white font-bold py-4 rounded-[2.5rem] mb-3 relative z-10 hover:opacity-90 transition-opacity"
            >
              ESSAYER GRATUITEMENT
            </button>
            
            <button
              onClick={() => setShowBoostPromoModal(false)}
              className="w-full text-white text-sm font-semibold py-2 relative z-10"
            >
              Peut-être plus tard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrophiesScreen;
