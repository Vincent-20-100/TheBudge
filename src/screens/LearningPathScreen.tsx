import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import { getAllCapsules, CapsuleMetadata } from '../services/CapsuleService';
import { useNavigation } from '../navigation/NavigationContext';
import { AppRoute } from '../types';
import { chatbotService, ChatMessage } from '../services/ChatbotService';
import { useUserProgress } from '../contexts/UserProgressContext';
import { getWeekDays, timeUntilFull } from '../utils/progressUtils';
import chestClosedImage from '../assets/chess.png';
import chestOpenImage from '../assets/chess-open.png';

interface Capsule extends CapsuleMetadata {
  completed: boolean;
  locked: boolean;
  isCurrent: boolean;
}

const LearningPathScreen: React.FC = () => {
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showDiamondsModal, setShowDiamondsModal] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showBoostPromoModal, setShowBoostPromoModal] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ type: 'image' | 'pdf'; name: string; data: string }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => typeof window !== 'undefined' && document.documentElement.classList.contains('dark-theme')
  );
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [visibleChestAnimations, setVisibleChestAnimations] = useState<Set<number>>(new Set());
  const chestRewardTimersRef = useRef<number[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const { progress, claimChest } = useUserProgress();
  const { streak, diamonds, energy, maxEnergy, currentCapsule, completedCapsules, claimedChests, lastLessonDate, energyLastUpdated } = progress;

  const { setCurrentRoute, setCurrentLesson } = useNavigation();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current && chatMessages.length > 0) {
      // Use setTimeout to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [chatMessages.length]);

  useEffect(() => {
    return () => {
      chestRewardTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      chestRewardTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains('dark-theme'));

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();

    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  // Initialiser Speech Recognition
  useEffect(() => {
    // Vérifier si l'API est disponible
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Arrêter après une pause
        recognition.interimResults = false; // Ne montrer que les résultats finaux
        recognition.lang = 'fr-FR'; // Français par défaut

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
          setIsRecording(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Erreur de reconnaissance vocale:', event.error);
          setIsRecording(false);
          if (event.error === 'not-allowed') {
            alert('Permission d\'accès au microphone refusée. Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.');
          } else if (event.error === 'no-speech') {
            alert('Aucune parole détectée. Veuillez réessayer.');
          } else {
            alert('Erreur lors de la reconnaissance vocale: ' + event.error);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignorer les erreurs lors du nettoyage
        }
      }
    };
  }, []);

  // Handle file selection for images
  const handleImageSelect = () => {
    imageInputRef.current?.click();
  };

  // Handle file selection for PDF
  const handlePdfSelect = () => {
    pdfInputRef.current?.click();
  };

  // Handle microphone/speech-to-text
  const handleMicrophoneClick = () => {
    if (!recognitionRef.current) {
      alert('La reconnaissance vocale n\'est pas disponible dans votre navigateur. Veuillez utiliser Chrome, Edge ou Safari.');
      return;
    }

    if (isRecording) {
      // Arrêter l'enregistrement
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (e) {
        console.error('Erreur lors de l\'arrêt:', e);
        setIsRecording(false);
      }
    } else {
      // Démarrer l'enregistrement
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e: any) {
        console.error('Erreur lors du démarrage:', e);
        if (e.message && e.message.includes('started')) {
          // Déjà en cours, on arrête puis on redémarre
          recognitionRef.current.stop();
          setTimeout(() => {
            if (recognitionRef.current) {
              recognitionRef.current.start();
              setIsRecording(true);
            }
          }, 100);
        } else {
          setIsRecording(false);
          alert('Impossible de démarrer l\'enregistrement. Veuillez vérifier les permissions du microphone.');
        }
      }
    }
  };

  // Handle file reading and conversion to base64
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (fileType === 'image') {
      if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
        alert('Veuillez sélectionner une image PNG ou JPEG');
        return;
      }
    } else if (fileType === 'pdf') {
      if (file.type !== 'application/pdf') {
        alert('Veuillez sélectionner un fichier PDF');
        return;
      }
    }

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Le fichier est trop volumineux (maximum 10 Mo)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedFiles(prev => [...prev, {
        type: fileType,
        name: file.name,
        data: result
      }]);
    };
    reader.onerror = () => {
      alert('Erreur lors de la lecture du fichier');
    };

    if (fileType === 'image') {
      reader.readAsDataURL(file);
    } else {
      reader.readAsDataURL(file);
    }

    // Reset input
    event.target.value = '';
    setShowAttachmentOptions(false);
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if ((!inputValue.trim() && selectedFiles.length === 0) || isLoading) return;

    const currentFiles = [...selectedFiles];
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim() || (currentFiles.length > 0 ? `[Fichier${currentFiles.length > 1 ? 's' : ''} joint${currentFiles.length > 1 ? 's' : ''}]` : ''),
      timestamp: new Date(),
      files: currentFiles.length > 0 ? currentFiles : undefined // Stocker les fichiers avec le message
    };

    // Add user message to chat with files
    setChatMessages(prev => [...prev, userMessage]);
    setSelectedFiles([]); // Vider après avoir stocké dans le message
    setInputValue('');
    setIsLoading(true);
    setShowAttachmentOptions(false);

    try {
      console.log('📤 Envoi du message au chatbot...', {
        message: userMessage.content,
        filesCount: currentFiles.length,
        files: currentFiles.map(f => ({ type: f.type, name: f.name }))
      });
      // Get AI response - passer l'historique actuel et les fichiers
      const response = await chatbotService.sendMessage(
        userMessage.content, 
        chatMessages,
        {
          files: currentFiles.length > 0 ? currentFiles : undefined
        }
      );
      console.log('Response received from chatbot service:', response);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack
      });
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erreur: ${error?.message || 'Une erreur est survenue. Veuillez réessayer.'}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const [capsules, setCapsules] = useState<Capsule[]>([]);

  useEffect(() => {
    const allMetadata = getAllCapsules();
    const pathLength = allMetadata.length; // 15 emplacements (leçons + coffres)

    // Un coffre réclamé débloque la leçon suivante (ne pas compter le coffre comme capsule).
    let effectiveCurrent = currentCapsule;
    for (let i = 0; i < pathLength; i++) {
      if (isChestNode(i) && claimedChests.includes(i)) {
        const nextLessonId = getLessonIdAtPathIndex(i + 1);
        if (nextLessonId != null && nextLessonId >= effectiveCurrent) {
          effectiveCurrent = nextLessonId;
        }
      }
    }

    const allCapsules: Capsule[] = [];
    for (let i = 0; i < pathLength; i++) {
      const lessonId = getLessonIdAtPathIndex(i);
      if (lessonId != null) {
        const meta = allMetadata[lessonId - 1];
        allCapsules.push({
          ...meta,
          id: lessonId,
          completed: completedCapsules.includes(lessonId),
          locked: lessonId > effectiveCurrent && !completedCapsules.includes(lessonId),
          isCurrent: lessonId === effectiveCurrent,
        });
      } else {
        // Emplacement coffre : pas une leçon ; id = leçon juste avant (pour claimChest → débloquer la suivante)
        const previousLessonId = getLessonIdAtPathIndex(i - 1)!;
        allCapsules.push({
          id: previousLessonId,
          title: 'Coffre',
          description: '',
          completed: false,
          locked: false,
          isCurrent: false,
        });
      }
    }
    setCapsules(allCapsules);
  }, [currentCapsule, completedCapsules, claimedChests]);

  const handleCapsuleClick = (capsule: Capsule) => {
    if (!capsule.locked) {
      setCurrentLesson({ capsuleId: capsule.id, blocIndex: 0 });
      setCurrentRoute(AppRoute.LESSON);
    }
  };

  const isChestNode = (index: number) => (index + 1) % 5 === 0;

  /** Lesson id at a path index (1-based). Returns null if this index is a chest. */
  const getLessonIdAtPathIndex = (pathIndex: number): number | null => {
    if (pathIndex < 0) return null;
    if (isChestNode(pathIndex)) return null;
    let chestCount = 0;
    for (let j = 0; j < pathIndex; j++) if (isChestNode(j)) chestCount++;
    return 1 + pathIndex - chestCount;
  };

  const handleChestClick = (index: number, capsuleId: number) => {
    if (claimedChests.includes(index)) return;

    claimChest(index, capsuleId, 10);

    setVisibleChestAnimations((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });

    const timerId = window.setTimeout(() => {
      setVisibleChestAnimations((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 2000);
    chestRewardTimersRef.current.push(timerId);
  };

  // Serpentin type "route" : 5 points vers la droite puis 5 vers la gauche.
  const zigzagPattern = [22, 40, 58, 76, 84, 76, 58, 40, 22, 16];
  const verticalStep = 98;
  const topPadding = 40;
  const bubbleSize = 72;

  const capsulePositions = capsules.map((_, index) => ({
    leftPercent: zigzagPattern[index % zigzagPattern.length],
    topPx: topPadding + index * verticalStep,
  }));

  const pathHeight = Math.max(
    topPadding + bubbleSize + 8,
    topPadding + (capsules.length - 1) * verticalStep + bubbleSize + 8
  );
  const firstChestIndex = capsules.findIndex((_, index) => isChestNode(index));
  const firstChestTopPx = firstChestIndex >= 0 ? capsulePositions[firstChestIndex].topPx : topPadding + 320;
  const chestIndices = capsules
    .map((_, index) => index)
    .filter((index) => isChestNode(index));
  const chestVisualCenterOffsetPx = 44;
  const bearSizePx = 300;
  const bearTopPx = Math.max(
    0,
    firstChestTopPx + chestVisualCenterOffsetPx - bearSizePx / 2
  );
  const moneyBearSizePx = 245;
  const moneyBearMobileSizePx = 190;
  const moneyBearTopPx = -20;
  const moneyTreeSizePx = 350;
  const moneyTreeScale = 1.42;
  const moneyTreeTopPx = topPadding + verticalStep * 6.92;
  const moneyTreeMobileTopOffsetPx = 205;
  const chestButtonBottomOffsetPx = 112;
  const firstChestBottomPx =
    chestIndices.length > 0
      ? capsulePositions[chestIndices[0]].topPx + chestButtonBottomOffsetPx
      : firstChestTopPx + chestButtonBottomOffsetPx;
  const secondChestBottomPx =
    chestIndices.length > 1
      ? capsulePositions[chestIndices[1]].topPx + chestButtonBottomOffsetPx
      : firstChestBottomPx + verticalStep * 5;
  const moneyBearEffectiveSizePx = isMobileViewport ? moneyBearMobileSizePx : moneyBearSizePx;
  const moneyBearAlignedTopPx = firstChestBottomPx - moneyBearEffectiveSizePx;
  const moneyTreeAlignedTopPx = secondChestBottomPx - moneyTreeSizePx * moneyTreeScale;

  const getCapsuleColor = (capsule: Capsule) => {
    if (capsule.completed) return 'rgb(250, 204, 21)';
    if (capsule.isCurrent) return 'rgb(139, 92, 246)';
    if (capsule.locked) return 'rgb(192, 197, 206)';
    return 'rgb(134, 202, 255)';
  };

  const completedCount = capsules.filter((c, i) => !isChestNode(i) && c.completed).length;
  const totalCapsules = 15; // nombre de leçons (les coffres ne comptent pas)
  const nextChestIndex = capsules.findIndex(
    (_, index) => isChestNode(index) && !claimedChests.includes(index)
  );
  const currentNodeIndex = Math.max(0, currentCapsule - 1 + Math.floor((currentCapsule - 1) / 4));
  const coursesUntilNextChest =
    nextChestIndex >= 0 ? Math.max(0, nextChestIndex - currentNodeIndex) : 0;
  const nextChestLabel =
    nextChestIndex >= 0 ? `dans ${coursesUntilNextChest} cours` : 'Tous les coffres ouverts';

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-x-hidden">
      {/* Mobile-only: verrou horizontal pour empêcher le déplacement latéral du path.
          Desktop (md+): comportement inchangé. */}
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
      
      {/* Streak Modal */}
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

      {/* Diamonds Modal */}
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
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-1">
              Diamants
            </h3>
            <p className="text-center mb-4">
              <span className="text-2xl font-extrabold text-[#8B5CF6]">{diamonds}</span>
              <span className="text-sm text-gray-600 ml-1">diamants</span>
            </p>
            <p className="text-sm text-gray-600 text-center mb-4">
              Les diamants peuvent être dépensés pour :
            </p>
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

      {/* Energy Modal */}
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
                className="w-full rounded-[2.5rem] p-4 text-white text-left hover:opacity-90 transition-opacity active:scale-95" 
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
                      <p className="text-xs text-gray-500">+{maxEnergy} énergie</p>
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

      {/* Boost Modal - Plans d'abonnement */}
      {showBoostModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setShowBoostModal(false)}
        >
          <div
            className="bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 rounded-[1.6rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-[min(420px,100vw-1rem)] p-4 sm:p-6 max-h-[86dvh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-4 sm:mb-5">Choisissez un plan</h3>
            
            <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-5">
              {/* Plan Familial */}
              <div className="rounded-[1.4rem] sm:rounded-[2rem] p-3.5 sm:p-4 text-white border border-purple-300/80 shadow-lg" style={{ background: 'linear-gradient(120deg, #10B981, #5BB4D8, #8B5CF6)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base sm:text-lg font-bold">Plan Familial</p>
                    <p className="text-xs sm:text-sm text-gray-100 mt-0.5">12 mois • 108,99 €</p>
                  </div>
                  <p className="text-[1.28rem] sm:text-[1.6rem] leading-none font-extrabold tracking-tight whitespace-nowrap text-right">
                    8,99<span className="text-[0.95rem] sm:text-lg"> €/MO</span>
                  </p>
                </div>
              </div>

              {/* Plan Individuel */}
              <div className="rounded-[1.4rem] sm:rounded-[2rem] p-3.5 sm:p-4 text-white border border-purple-300/80 shadow-lg" style={{ background: 'linear-gradient(120deg, #10B981, #5BB4D8, #8B5CF6)' }}>
                <div className="mb-2">
                  <span className="inline-flex items-center bg-green-500 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-extrabold tracking-wide text-white">
                    LE PLUS POPULAIRE
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base sm:text-lg font-bold">Individuel</p>
                    <p className="text-xs sm:text-sm text-gray-100 mt-0.5">12 mois • 76,99 €</p>
                  </div>
                  <p className="text-[1.28rem] sm:text-[1.6rem] leading-none font-extrabold tracking-tight whitespace-nowrap text-right">
                    5,99<span className="text-[0.95rem] sm:text-lg"> €/MO</span>
                  </p>
                </div>
              </div>
              <div className="text-center text-white/90 text-[11px] sm:text-xs mb-1 tracking-wide">
                <p>ESSAI GRATUIT DE 7 JOURS</p>
                <div className="w-full h-px bg-white/25 my-2"></div>
              </div>

              {/* Plan Mensuel */}
              <div className="rounded-[1.4rem] sm:rounded-[2rem] p-3.5 sm:p-4 text-white border border-purple-300/80 shadow-lg" style={{ background: 'linear-gradient(120deg, #10B981, #5BB4D8, #8B5CF6)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base sm:text-lg font-bold">Mensuel</p>
                  </div>
                  <p className="text-[1.28rem] sm:text-[1.6rem] leading-none font-extrabold tracking-tight whitespace-nowrap text-right">
                    11,99<span className="text-[0.95rem] sm:text-lg"> €/MO</span>
                  </p>
                </div>
              </div>
              <div className="text-center text-white/90 text-[11px] sm:text-xs mb-1 tracking-wide">
                <p>PAS D'ESSAI GRATUIT</p>
                <div className="w-full h-px bg-white/25 my-2"></div>
              </div>

              {/* Plan Étudiant */}
              <div className="rounded-[1.4rem] sm:rounded-[2rem] p-3.5 sm:p-4 text-white border-2 border-purple-300 shadow-xl" style={{ background: 'linear-gradient(120deg, #10B981, #5BB4D8, #8B5CF6)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center bg-green-500 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-extrabold tracking-wide text-white">
                    50% DE RÉDUCTION
                  </span>
                  <span className="text-blue-200 text-lg font-bold">✓</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-bold">Plan Étudiant</p>
                    <p className="text-xs sm:text-sm text-gray-100 mt-0.5">12 mois • 34,99 €</p>
                    <p className="text-[11px] sm:text-xs text-gray-200 mt-1">Le statut étudiant doit être vérifié</p>
                  </div>
                  <p className="text-[1.28rem] sm:text-[1.6rem] leading-none font-extrabold tracking-tight whitespace-nowrap text-right flex-shrink-0">
                    2,99<span className="text-[0.95rem] sm:text-lg"> €/MO</span>
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-gray-300/90 text-center mb-3 sm:mb-4">Annulez à tout moment dans l'App Store</p>
            
            <button
              onClick={() => setShowBoostModal(false)}
              className="w-full bg-white text-gray-900 font-extrabold py-3.5 sm:py-4 rounded-[1.6rem] sm:rounded-[2rem] hover:bg-gray-100 transition-colors mb-2 shadow-lg"
            >
              OBTENIR BOOST
            </button>
            
            <button
              onClick={() => setShowBoostModal(false)}
              className="w-full text-white/95 text-sm font-semibold py-2 hover:text-white transition-colors"
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
                    <p className="text-white font-semibold mb-1">Prouvez vos connaissances</p>
                    <p className="text-gray-300 text-sm">Démontrez votre maîtrise avec des certifications</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <button
                onClick={() => setShowBoostPromoModal(false)}
                className="w-full bg-white text-gray-900 font-bold py-4 rounded-[2.5rem] hover:bg-gray-100 transition-colors mb-3 shadow-lg"
              >
                ESSAYER GRATUITEMENT
              </button>
              <button
                onClick={() => setShowBoostPromoModal(false)}
                className="w-full text-white text-sm font-semibold py-2"
              >
                NON MERCI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Modal */}
      {showChatbotModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: '16px' }}
          onClick={() => setShowChatbotModal(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl flex flex-col relative"
            style={{ 
              width: 'calc(100% - 32px)',
              maxWidth: '360px',
              height: '85vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">TheBudgeAI</h3>
              <button
                onClick={() => setShowChatbotModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 scrollbar-hide"
            >
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="mb-3 sm:mb-4">
                    <img 
                      src="assets/architect_b.png" 
                      alt="TheBudgeAI"
                      className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <p className="text-gray-500 text-xs sm:text-sm text-center px-2">
                    Posez-moi vos questions sur la finance !
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {chatMessages.map((message) => (
                    <div key={message.id} className="flex flex-col gap-2">
                      <div
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-[1.5rem] px-4 py-2 ${
                            message.role === 'user'
                              ? 'bg-[#8B5CF6] text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {/* Afficher les fichiers s'ils existent */}
                          {message.files && message.files.length > 0 && (
                            <div className="mb-2 space-y-2">
                              {message.files.map((file, fileIndex) => (
                                <div key={fileIndex} className="rounded-lg overflow-hidden">
                                  {file.type === 'image' ? (
                                    <div className={message.role === 'user' ? 'bg-white bg-opacity-20 rounded-lg p-2 flex items-center gap-2' : 'bg-gray-200 rounded-lg p-2 flex items-center gap-2'}>
                                      <img 
                                        src={file.data} 
                                        alt={file.name}
                                        className="w-12 h-12 rounded-lg object-cover"
                                      />
                                      <span className={`text-xs truncate flex-1 ${message.role === 'user' ? 'text-white' : 'text-gray-700'}`}>{file.name}</span>
                                    </div>
                                  ) : (
                                    <div className={message.role === 'user' ? 'bg-white bg-opacity-20 rounded-lg p-2 flex items-center gap-2' : 'bg-gray-200 rounded-lg p-2 flex items-center gap-2'}>
                                      <span className="text-xl">📄</span>
                                      <span className={`text-xs truncate flex-1 ${message.role === 'user' ? 'text-white' : 'text-gray-700'}`}>{file.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Afficher les fichiers sélectionnés dans une bulle de conversation avant l'envoi */}
                  {selectedFiles.length > 0 && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-[1.5rem] px-4 py-2 bg-[#8B5CF6] text-white">
                        <div className="mb-2 space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="rounded-lg overflow-hidden">
                              {file.type === 'image' ? (
                                <div className="bg-white bg-opacity-20 rounded-lg p-2 flex items-center gap-2">
                                  <img 
                                    src={file.data} 
                                    alt={file.name}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                  <span className="text-xs text-white truncate flex-1">{file.name}</span>
                                  <button
                                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                                    className="text-white hover:text-gray-200 text-sm"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-white bg-opacity-20 rounded-lg p-2 flex items-center gap-2">
                                  <span className="text-xl">📄</span>
                                  <span className="text-xs text-white truncate flex-1">{file.name}</span>
                                  <button
                                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                                    className="text-white hover:text-gray-200 text-sm"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-white opacity-70 italic">Fichier{selectedFiles.length > 1 ? 's' : ''} prêt{selectedFiles.length > 1 ? 's' : ''} à être envoyé{selectedFiles.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-[1.5rem] px-4 py-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Attachment Options Modal */}
            {showAttachmentOptions && (
              <div 
                className="absolute bg-white rounded-[2.5rem] shadow-lg border-2 border-gray-200 p-3 sm:p-4 z-10"
                style={{
                  bottom: '80px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '90%',
                  maxWidth: '300px'
                }}
              >
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setShowAttachmentOptions(false)}
                    className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <button 
                    onClick={handleImageSelect}
                    className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 sm:gap-3"
                  >
                    <span className="text-xl sm:text-2xl">🖼️</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">Image</p>
                      <p className="text-xs text-gray-500">Insérer une image</p>
                    </div>
                  </button>
                  <button 
                    onClick={handlePdfSelect}
                    className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 sm:gap-3"
                  >
                    <span className="text-xl sm:text-2xl">📎</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">PDF</p>
                      <p className="text-xs text-gray-500">Insérer un PDF</p>
                    </div>
                  </button>
                </div>
                {/* Hidden file inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e, 'image')}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e, 'pdf')}
                />
              </div>
            )}

            {/* Input Bar */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 relative">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setShowAttachmentOptions(!showAttachmentOptions)}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <input
                  type="text"
                  placeholder="Posez votre question..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && (inputValue.trim() || selectedFiles.length > 0) && !isLoading) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading || isRecording}
                  className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-[2.5rem] focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900 placeholder-gray-600 text-sm sm:text-base disabled:opacity-50"
                />

                {/* Colonne : bouton d'envoi au-dessus du microphone (évite débordement mobile + cohérent PC) */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {(inputValue.trim() || selectedFiles.length > 0) && !isRecording && (
                    <button
                      onClick={handleSendMessage}
                      disabled={isLoading}
                      className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Envoyer le message"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={handleMicrophoneClick}
                    disabled={isLoading}
                    className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'hover:bg-gray-100'
                    }`}
                    title={isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer la dictée vocale'}
                  >
                    <svg
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${isRecording ? 'text-white' : 'text-gray-600'}`}
                      fill={isRecording ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#8B5CF6] px-3 md:px-4 pt-1 md:pt-2 pb-2 md:pb-4 text-white shadow-sm">
        <h1 className="text-[1.78rem] md:text-2xl font-bold mb-0 md:mb-1 leading-[1.04]">Unité 1</h1>
        <p className="text-[0.88rem] md:text-sm opacity-90 leading-[1.18]">Les bases de la finance et de la bourse</p>
      </div>

      {/* Mobile-only: scroll vertical uniquement.
          Desktop (md+): pas de blocage horizontal forcé. */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide ${isDarkTheme ? 'bg-[#0B1220]' : 'bg-[#F3F4F6]'}`}
      >
        <div className="w-full pt-2 md:pt-3 pb-16 md:pb-14">
          <div
            className={`sticky top-0 z-30 px-3 md:px-4 mb-2 md:mb-3 pt-1 pb-1.5 md:pb-2 ${
              isDarkTheme ? 'bg-[#0B1220]/95' : 'bg-[#F3F4F6]/95 backdrop-blur-sm'
            }`}
          >
            <div className={`rounded-2xl border shadow-sm px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between ${
              isDarkTheme
                ? 'bg-[#111827] border-[#334155]'
                : 'bg-white/95 border-[#E5E7EB]'
            }`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">Progression</p>
                <p className={`text-[0.98rem] md:text-sm font-bold leading-tight ${isDarkTheme ? 'text-slate-100' : 'text-gray-800'}`}>
                  {completedCount}/{totalCapsules} leçons complétées
                </p>
              </div>
              <div className="text-right">
                <p className={`text-[10px] md:text-[11px] ${isDarkTheme ? 'text-slate-400' : 'text-gray-500'}`}>Prochain coffre</p>
                <p className={`text-[0.95rem] md:text-xs font-bold leading-tight ${isDarkTheme ? 'text-slate-200' : 'text-gray-700'}`}>{nextChestLabel}</p>
              </div>
            </div>
          </div>

          {/* Duolingo Learning Path - Zigzag */}
          {/* Mobile-only: empêcher le drag horizontal du path.
              Desktop (md+): conserver le layout d'origine. */}
          <div className="relative w-full px-2 sm:px-4">
            <div className="relative w-full" style={{ height: `${pathHeight}px` }}>
              <div
                className="absolute z-10 pointer-events-none"
                style={{ left: '4%', top: `${isMobileViewport ? moneyBearAlignedTopPx : bearTopPx}px` }}
              >
                <img
                  src="bear_assets/assis%20sur%20l'argent.png"
                  alt="Ours assis sur l'argent"
                  className="object-contain drop-shadow-xl"
                  style={{
                    width: `${moneyBearEffectiveSizePx}px`,
                    height: `${moneyBearEffectiveSizePx}px`,
                  }}
                />
              </div>

              <div
                className="absolute z-10 pointer-events-none"
                style={{ left: '54%', top: `${moneyBearTopPx}px` }}
              >
                <img
                  src="bear_assets/ours%20avec%20des%20livres.png"
                  alt="Ours avec des livres"
                  className="object-contain drop-shadow-xl"
                  style={{ width: `${bearSizePx}px`, height: `${bearSizePx}px` }}
                />
              </div>

              <div
                className="absolute z-10 pointer-events-none"
                style={{
                  left: '52%',
                  top: `${isMobileViewport ? moneyTreeAlignedTopPx + moneyTreeMobileTopOffsetPx : moneyTreeTopPx}px`,
                }}
              >
                <img
                  src="bear_assets/arbre%20a%20sous.png"
                  alt="Arbre à sous"
                  className="object-contain drop-shadow-xl"
                  style={{
                    width: `${moneyTreeSizePx}px`,
                    height: `${moneyTreeSizePx}px`,
                    transform: `scale(${moneyTreeScale})`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>

              {capsules.map((capsule, index) => {
                const position = capsulePositions[index];
                const capsuleColor = getCapsuleColor(capsule);
                const chestNode = isChestNode(index);
                const chestClaimed = claimedChests.includes(index);
                const chestLocked = index > 0 && !capsules[index - 1]?.completed;
                const showChestReward = visibleChestAnimations.has(index);
                const chestOrder = chestNode ? Math.floor((index + 1) / 5) : 0;
                const isOddChest = chestOrder % 2 === 1;
                const nodeBaseStyle = capsule.isCurrent
                  ? { backgroundColor: 'rgba(148, 163, 184, 0.42)' }
                  : { backgroundColor: capsuleColor, filter: 'brightness(0.8)' };
                const nodeButtonStyle = capsule.isCurrent
                  ? { backgroundColor: capsuleColor, boxShadow: '0 10px 24px rgba(139, 92, 246, 0.28)' }
                  : { backgroundColor: capsuleColor };

                return (
                  <div
                    key={chestNode ? `chest-${index}` : capsule.id}
                    className="absolute -translate-x-1/2 transition-all duration-300"
                    style={{ left: `${position.leftPercent}%`, top: `${position.topPx}px` }}
                  >
                    <div className="relative flex flex-col items-center">
                      {chestNode ? (
                        <button
                          onClick={() => handleChestClick(index, capsule.id)}
                          className={`relative w-[136px] h-[136px] -translate-y-6 flex items-center justify-center transition-all duration-200 ${
                            chestLocked
                              ? 'opacity-40 cursor-not-allowed'
                              : chestClaimed
                              ? 'opacity-75 cursor-default'
                              : 'cursor-pointer hover:scale-105 active:scale-100'
                          }`}
                          aria-label={chestLocked ? 'Coffre verrouillé' : chestClaimed ? 'Coffre déjà ouvert' : 'Ouvrir le coffre et gagner 10 diamants'}
                          disabled={chestLocked || chestClaimed}
                          title={chestLocked ? 'Terminez la leçon précédente pour débloquer' : chestClaimed ? 'Coffre déjà ouvert' : '+10 diamants'}
                        >
                          <img
                            src={chestClaimed ? chestOpenImage : chestClosedImage}
                            alt={chestClaimed ? 'Coffre ouvert' : 'Coffre de récompense'}
                            className="w-[130px] h-[130px] object-contain drop-shadow-xl"
                          />
                          {showChestReward && (
                            <span
                              className={`absolute px-2 py-0.5 rounded-full bg-[#8B5CF6] text-white text-[10px] font-bold animate-pulse ${
                                isOddChest
                                  ? 'left-0 top-1/2 -translate-x-[85%] -translate-y-1/2'
                                  : 'right-0 top-1/2 translate-x-[85%] -translate-y-1/2'
                              }`}
                            >
                              +10
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className={`relative w-[72px] h-[80px] ${capsule.locked ? 'opacity-55' : ''}`}>
                          <span className="absolute inset-x-0 bottom-0 h-[72px] rounded-full" style={nodeBaseStyle} />

                          <button
                            onClick={() => handleCapsuleClick(capsule)}
                            className={`absolute inset-x-0 top-0 w-[72px] h-[72px] rounded-full flex items-center justify-center border-4 border-white transition-all duration-200 z-10 font-bold text-3xl shadow-xl ${
                              capsule.locked
                                ? 'cursor-not-allowed'
                                : `cursor-pointer active:scale-100 ${capsule.isCurrent ? 'hover:scale-110' : 'hover:scale-105'}`
                            }`}
                            style={nodeButtonStyle}
                            aria-label={capsule.title}
                            disabled={capsule.locked}
                          >
                            <span className="absolute top-2 left-3 w-6 h-3 rounded-full bg-white/25 rotate-[-18deg]" />

                            <span>
                              {capsule.completed && <span className="text-white font-bold">✓</span>}
                              {capsule.isCurrent && <span className="text-white">⭐</span>}
                              {capsule.locked && <span className="text-gray-700">🔒</span>}
                              {!capsule.completed && !capsule.isCurrent && !capsule.locked && <span className="text-white">📖</span>}
                            </span>

                            {capsule.isCurrent && (
                              <div className="absolute -inset-3 rounded-full border-4 border-yellow-300 animate-pulse" style={{ animationDuration: '2s' }} />
                            )}
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Architect Image with Speech Bubble - Bottom of page */}
        <div className="flex items-center gap-4 mt-0 mb-40 md:mb-28">
          <div className="flex-shrink-0">
            <img 
              src="assets/architect_b.png" 
              alt="Architecte"
              className="w-24 h-24 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-200 px-4 py-3 max-w-xs">
            <p className="text-gray-800 text-sm leading-relaxed font-medium">
              ⚠️ Attention chantier, de nouvelles leçons arrivent bientôt !
            </p>
          </div>
        </div>

        {/* Bear Mascot Button */}
        <div className="absolute right-2 bottom-36 md:bottom-28 z-20 animate-bounce" style={{ maxWidth: 'calc(100% - 2rem)' }}>
          <div 
            onClick={() => setShowChatbotModal(true)}
            className="w-16 h-16 bg-[#8B5CF6] rounded-full flex items-center justify-center shadow-xl border-4 border-white cursor-pointer hover:scale-110 transition-transform overflow-hidden"
          >
            <img 
              src="bear_assets/mascot-bear.png" 
              alt="Mascotte ours"
              className="w-14 h-14 object-cover rounded-full"
              style={{ 
                objectFit: 'cover',
                objectPosition: 'center'
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLSpanElement;
                if (fallback) {
                  fallback.style.display = 'block';
                }
              }}
            />
            <span className="text-3xl" style={{ display: 'none' }}>🐻</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningPathScreen;
