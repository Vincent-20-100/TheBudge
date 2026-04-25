import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '../navigation/NavigationContext';
import { AppRoute } from '../types';
import { loadCapsule, parseQuestion, parseExplanation, formatContent, parseContentWithImages, Block } from '../services/CapsuleParser';
import { getRandomMotivationPhrase, getRandomFelicitationPhrase, getRandomBearImage, getRandomQuizPausePhrase, loadQuizPausePhrases } from '../services/PhraseService';
import { chatbotService, ChatMessage } from '../services/ChatbotService';
import { useUserProgress } from '../contexts/UserProgressContext';

const LessonScreen: React.FC = () => {
  const { currentLesson, setCurrentRoute, setCurrentLesson } = useNavigation();
  const { completeLesson, xpPerLesson, energyPerLesson } = useUserProgress();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(-1); // Start at -1 for intro page
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [introImage, setIntroImage] = useState<string>('');
  const [introPhrase, setIntroPhrase] = useState('');
  const [endImage, setEndImage] = useState<string>('');
  const [endPhrase, setEndPhrase] = useState('');
  const [showingQuizPause, setShowingQuizPause] = useState(false);
  const [quizPauseImage, setQuizPauseImage] = useState<string>('');
  const [quizPausePhrase, setQuizPausePhrase] = useState('');
  const [quizPausePhrasesList, setQuizPausePhrasesList] = useState<string[] | null>(null);
  const [showLessonCompleteModal, setShowLessonCompleteModal] = useState(false);
  const [showStreakCongrats, setShowStreakCongrats] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ type: 'image' | 'pdf'; name: string; data: string }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const cleanLessonHeaderTitle = (title: string): string => {
    return title
      .replace(/^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\s]+/gu, '')
      .replace(/^[0-9]+\uFE0F?\u20E3\s*/u, '')
      .trim();
  };

  // Replace Unicode flag emojis with Twemoji images so flags display correctly on all platforms (e.g. Windows)
  const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';
  const flagImgClass = 'inline-block w-5 h-4 object-contain align-middle mr-0.5';
  const renderTextWithFlags = (value: string): React.ReactNode => {
    // 🇺🇸 US, 🇫🇷 FR, 🇩🇰 DK — Twemoji for consistent display (e.g. Windows shows "US"/"DK" otherwise)
    const parts = value.split(/(\u{1F1FA}\u{1F1F8}|\u{1F1EB}\u{1F1F7}|\u{1F1E9}\u{1F1F0})/gu);
    return parts.map((part, i) => {
      if (part === '\u{1F1FA}\u{1F1F8}') {
        return <img key={i} src={`${TWEMOJI_BASE}/1f1fa-1f1f8.png`} alt="US" className={flagImgClass} />;
      }
      if (part === '\u{1F1EB}\u{1F1F7}') {
        return <img key={i} src={`${TWEMOJI_BASE}/1f1eb-1f1f7.png`} alt="FR" className={flagImgClass} />;
      }
      if (part === '\u{1F1E9}\u{1F1F0}') {
        return <img key={i} src={`${TWEMOJI_BASE}/1f1e9-1f1f0.png`} alt="DK" className={flagImgClass} />;
      }
      return part;
    });
  };
  const renderPillContent = (value: string): React.ReactNode => renderTextWithFlags(value);

  // Renders a paragraph with [[...]] as inline badge (small bordered square on same line) and flags as images
  const renderParagraphWithInlineBadges = (para: string): React.ReactNode => {
    const parts = para.split(/(\[\[[^\]]+\]\])/g);
    return parts.map((part, k) => {
      const m = part.match(/^\[\[([^\]]+)\]\]$/);
      if (m) {
        return (
          <span
            key={k}
            className="inline rounded border-2 border-gray-300 bg-transparent px-2 py-0.5 font-medium align-baseline"
          >
            {m[1]}
          </span>
        );
      }
      return renderTextWithFlags(part);
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains('dark-theme'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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
            recognitionRef.current.start();
            setIsRecording(true);
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

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Le fichier est trop volumineux. Taille maximale : 10MB');
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

    reader.readAsDataURL(file);

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
      // Préparer le contexte de la leçon pour le chatbot
      const currentBlock = currentBlockIndex >= 0 && blocks.length > currentBlockIndex ? blocks[currentBlockIndex] : null;
      
      console.log('📤 Envoi du message au chatbot...', {
        message: userMessage.content,
        filesCount: currentFiles.length,
        files: currentFiles.map(f => ({ type: f.type, name: f.name })),
        capsuleId: currentLesson?.capsuleId,
        blockIndex: currentBlockIndex
      });
      
      // Get AI response - passer l'historique actuel et les fichiers avec le contexte
      const response = await chatbotService.sendMessage(
        userMessage.content, 
        chatMessages,
        {
          capsuleId: currentLesson ? String(currentLesson.capsuleId) : '',
          blockId: currentBlockIndex >= 0 ? String(currentBlockIndex + 1) : '',
          blockText: currentBlock ? (currentBlock.title + '\n' + currentBlock.content) : '',
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

  useEffect(() => {
    if (currentLesson) {
      setLoading(true);
      setCurrentBlockIndex(-1); // Start with intro page
      setSelectedAnswer(null);
      setShowError(false);
      
      // Select random intro image and phrase
      const randomIntroImage = getRandomBearImage();
      const randomIntroPhrase = getRandomMotivationPhrase();
      setIntroImage(randomIntroImage);
      setIntroPhrase(randomIntroPhrase);
      
      // Select random end image and phrase
      const randomEndImage = getRandomBearImage();
      const randomEndPhrase = getRandomFelicitationPhrase();
      setEndImage(randomEndImage);
      setEndPhrase(randomEndPhrase);
      
      setShowingQuizPause(false);
      loadQuizPausePhrases().then(setQuizPausePhrasesList);
      
      loadCapsule(currentLesson.capsuleId).then(loadedBlocks => {
        if (loadedBlocks && loadedBlocks.length > 0) {
          setBlocks(loadedBlocks);
        } else {
          console.error('No blocks loaded for capsule', currentLesson.capsuleId);
        }
        setLoading(false);
      }).catch(error => {
        console.error('Error loading capsule:', error);
        setLoading(false);
      });
    }
  }, [currentLesson]);

  // Track if we're in an automatic transition from question to explanation
  const isAutoTransitionRef = useRef<boolean>(false);
  
  // Reset answer state only when manually navigating (not during auto transition)
  useEffect(() => {
    if (isAutoTransitionRef.current) {
      // We just had an automatic transition, don't reset yet
      isAutoTransitionRef.current = false;
      return;
    }
    
    // Manual navigation - reset answer state
    if (currentBlockIndex >= 0) {
      setSelectedAnswer(null);
      setShowError(false);
    }
  }, [currentBlockIndex]);

  const handleAnswerSelect = (answerLetter: string) => {
    setSelectedAnswer(answerLetter);
    setShowError(false);
    
    // Find the correct answer from the next block (explanation block)
    const nextBlock = blocks[currentBlockIndex + 1];
    if (nextBlock && (nextBlock.title.toLowerCase().includes('explication') || nextBlock.content.toLowerCase().includes('réponse correcte'))) {
      const explanation = parseExplanation(nextBlock.content);
      const correctLetter = explanation.correctLetter || 'b';
      
      if (answerLetter === correctLetter) {
        // Correct answer - move to explanation after a short delay
        isAutoTransitionRef.current = true; // Mark as automatic transition
        setTimeout(() => {
          setCurrentBlockIndex(currentBlockIndex + 1);
        }, 500);
      } else {
        // Wrong answer - show error but allow to try again
        setShowError(true);
      }
    } else {
      // No explanation block found, just mark as selected
      console.warn('No explanation block found after question');
    }
  };

  const handlePrevious = () => {
    if (showingQuizPause) {
      setShowingQuizPause(false);
      return;
    }
    if (currentBlockIndex === -1) {
      return;
    }
    if (currentBlockIndex === blocks.length) {
      setCurrentBlockIndex(blocks.length - 1);
      return;
    }
    if (currentBlockIndex > 0) {
      setCurrentBlockIndex(currentBlockIndex - 1);
      setSelectedAnswer(null);
      setShowError(false);
    } else if (currentBlockIndex === 0) {
      setCurrentBlockIndex(-1);
    }
  };

  const handleNext = () => {
    if (currentBlockIndex === -1) {
      setCurrentBlockIndex(0);
      return;
    }
    
    // If we're on the quiz pause screen, go to the quiz block
    if (showingQuizPause) {
      setShowingQuizPause(false);
      setCurrentBlockIndex(currentBlockIndex + 1);
      return;
    }
    
    // If on a question block with error, reset the question state
    if (isQuestionBlock && showError) {
      setSelectedAnswer(null);
      setShowError(false);
      return;
    }
    
    // If on a question block and no answer selected, don't allow next (unless question failed to parse → allow next to unblock)
    if (isQuestionBlock && selectedAnswer === null) {
      const questionData = currentBlock ? parseQuestion(currentBlock.content) : null;
      if (questionData) return; // valid question: require answer
      // parseQuestion returned null: allow next so user is not stuck
    }
    
    // If next block is the first quiz (Vérification des Connaissances), show quiz pause transition once
    const nextIndex = currentBlockIndex + 1;
    const nextBlock = nextIndex < blocks.length ? blocks[nextIndex] : null;
    const nextIsQuizBlock = nextBlock && nextBlock.title.toLowerCase().includes('vérification');
    const firstQuizIndex = blocks.findIndex(b => b.title.toLowerCase().includes('vérification'));
    if (nextIsQuizBlock && firstQuizIndex >= 0 && nextIndex === firstQuizIndex) {
      setQuizPauseImage(getRandomBearImage());
      setQuizPausePhrase(getRandomQuizPausePhrase(quizPausePhrasesList ?? undefined));
      setShowingQuizPause(true);
      return;
    }
    
    // For explanation blocks or regular blocks, allow next
    if (currentBlockIndex < blocks.length - 1) {
      setCurrentBlockIndex(currentBlockIndex + 1);
    } else {
      // Lesson completed, go to end page
      setCurrentBlockIndex(blocks.length);
    }
  };

  const handleStartLesson = () => {
    setCurrentBlockIndex(0);
  };

  const handleFinishLesson = () => {
    setShowLessonCompleteModal(true);
    if (currentLesson) {
      completeLesson(currentLesson.capsuleId, () => setShowStreakCongrats(true));
    }
  };

  const handleCloseLessonCompleteModal = () => {
    setShowLessonCompleteModal(false);
    setShowStreakCongrats(false);
    setCurrentRoute(AppRoute.ACADEMY);
    setCurrentLesson(null);
  };

  const handleClose = () => {
    setCurrentRoute(AppRoute.ACADEMY);
    setCurrentLesson(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full w-full bg-white items-center justify-center">
        <div className="text-gray-500">Chargement de la leçon...</div>
      </div>
    );
  }

  if (!currentLesson || blocks.length === 0) {
    return (
      <div className="flex flex-col h-full w-full bg-white items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Aucune leçon sélectionnée</p>
          <button
            onClick={handleClose}
            className="bg-[#8B5CF6] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#7C3AED] transition-colors"
          >
            Retour à l'académie
          </button>
        </div>
      </div>
    );
  }

  const isIntroPage = currentBlockIndex === -1;
  const isEndPage = currentBlockIndex === blocks.length;
  const currentBlock = currentBlockIndex >= 0 && currentBlockIndex < blocks.length ? blocks[currentBlockIndex] : null;
  // Uniquement le titre : éviter que "Accroche" ou "Mini-exercice" affichent "Vérification des Connaissances" (le contenu peut contenir le mot "question" hors quiz)
  const isQuestionBlock = currentBlock ? currentBlock.title.toLowerCase().includes('vérification') : false;
  const isExplanationBlock = currentBlock ? currentBlock.title.toLowerCase().includes('explication') : false;
  const isLastBlock = currentBlockIndex === blocks.length - 1;
  // Leçon 9, bloc "Notre communauté" : afficher un bouton "Rejoins-nous" (factice) sous la carte
  const isCommunityBlock = currentLesson && Number(currentLesson.capsuleId) === 9 && currentBlock && currentBlock.title.toLowerCase().includes('communauté');
  // Leçon 4, deux derniers blocs (12 et 13) : affichage simplifié, sans cartes ni boîtes
  const simplifyNoCards = currentLesson && Number(currentLesson.capsuleId) === 4 && currentBlock && (currentBlock.number === 11 || currentBlock.number === 12);

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-white relative md:min-h-0 max-md:h-[100dvh] max-md:max-h-[100dvh]">
      {/* Header with close button */}
      <div className="w-full flex-shrink-0 bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#8B5CF6] h-2 rounded-full transition-all duration-300"
              style={{ width: isIntroPage ? '0%' : isEndPage ? '100%' : showingQuizPause ? `${((currentBlockIndex + 1) / blocks.length) * 100}%` : `${((currentBlockIndex + 1) / blocks.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Lesson Content — min-h-0 so flex allows scroll on mobile */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-6 scrollbar-hide">
        <div className={`${isIntroPage || isEndPage || showingQuizPause ? 'w-full h-full' : 'max-w-lg mx-auto'}`}>
          {/* Intro Page */}
          {isIntroPage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src={introImage} 
                  alt="Ours motivant"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 'calc(100vh - 200px)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-9xl hidden">🐻</span>
              </div>
              <div className="absolute top-4 left-4 bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 max-w-xs z-10">
                <p className="text-gray-800 text-base leading-relaxed font-medium">
                  {introPhrase}
                </p>
              </div>
            </div>
          )}

          {/* End Page */}
          {isEndPage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src={endImage} 
                  alt="Ours félicitant"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 'calc(100vh - 200px)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-9xl hidden">🐻</span>
              </div>
              <div className="absolute top-4 left-4 bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 max-w-xs z-10">
                <p className="text-gray-800 text-base leading-relaxed font-medium">
                  {endPhrase}
                </p>
              </div>
            </div>
          )}

          {/* Quiz Pause – transition avant la partie Vérification des Connaissances */}
          {showingQuizPause && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src={quizPauseImage} 
                  alt="Transition quiz"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 'calc(100vh - 200px)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-9xl hidden">🐻</span>
              </div>
              <div className="absolute top-4 left-4 bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 max-w-xs z-10">
                <p className="text-gray-800 text-base leading-relaxed font-medium">
                  {quizPausePhrase}
                </p>
              </div>
            </div>
          )}

          {/* Regular Lesson Content */}
          {!isIntroPage && !isEndPage && !showingQuizPause && currentBlock && (
            <>
              {/* Leçon 4 blocs 12 et 13 : une seule carte, contenu brut, zéro formatage */}
              {simplifyNoCards && (() => {
                const raw = currentBlock.content;
                const cleaned = raw
                  .replace(/\r\n/g, '\n')
                  .replace(/^\s*►!?\s*/gm, '')
                  .replace(/^\s*►#\s*/gm, '')
                  .replace(/\[\[([^\]]+)\]\]/g, '$1');
                let text = cleaned;
                if (isExplanationBlock) {
                  const lines = cleaned.split('\n');
                  let seenCorrect = false;
                  text = lines.filter((line) => {
                    const t = line.trim();
                    if (!t.includes('Réponse correcte')) return true;
                    if (seenCorrect) return false;
                    seenCorrect = true;
                    return true;
                  }).join('\n');
                }
                const cardBg = isDarkTheme ? "bg-[#111827] border-gray-600" : "bg-gray-50/50 border-gray-200";
                const textMain = isDarkTheme ? "text-gray-100" : "text-gray-800";
                const textMuted = isDarkTheme ? "text-gray-400" : "text-gray-600";
                const textTitle = isDarkTheme ? "text-white" : "text-gray-900";
                return (
                  <div className={`rounded-xl border p-6 text-base leading-relaxed whitespace-pre-line ${cardBg} ${textMain}`}>
                    {isQuestionBlock ? (
                      <>
                        {(() => {
                          const q = parseQuestion(currentBlock.content);
                          if (!q) return null;
                          return (
                            <>
                              <div className={`text-sm mb-3 ${textMuted}`}>Question {q.number} sur {q.total}</div>
                              <div className="mb-4">{q.question}</div>
                              <div className="space-y-2">
                                {q.options.map((opt, i) => {
                                  const isSelected = selectedAnswer === opt.letter;
                                  const isWrong = showError && isSelected;
                                  const btnClass = isWrong
                                    ? "border-red-500"
                                    : isSelected
                                    ? (isDarkTheme ? "border-[#8B5CF6] bg-[#8B5CF6]/20" : "border-[#8B5CF6] bg-purple-50/50")
                                    : (isDarkTheme ? "border-gray-500 hover:border-gray-400 bg-[#1e293b]" : "border-gray-200 hover:border-gray-300");
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => handleAnswerSelect(opt.letter)}
                                      className={`w-full text-left p-3 rounded-lg border transition-all ${btnClass}`}
                                    >
                                      <span className="font-medium text-[#8B5CF6]">{opt.letter})</span>{' '}
                                      <span className={isDarkTheme ? "text-gray-100" : "text-gray-800"}>{opt.text}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {showError && (
                                <div className="mt-3 text-red-400 text-sm">❌ Mauvaise réponse, réessayer.</div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <div className={`font-semibold mb-3 ${textTitle}`}>Explication</div>
                        {text}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Titre (caché pour simplifyNoCards car inclus dans la carte) */}
              {!simplifyNoCards && (
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {(isQuestionBlock ? 'Vérification des Connaissances' : (cleanLessonHeaderTitle(currentBlock.title).trim() || currentBlock.title.trim()))}
                  </h1>
                </div>
              )}

              {/* Question Block (affichage normal) */}
              {!simplifyNoCards && isQuestionBlock && (() => {
                const questionData = parseQuestion(currentBlock.content);
                if (!questionData) {
                  // Fallback: show raw content so user sees the question and can click Suivant
                  return (
                    <div className="bg-transparent rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-4">
                      <div className="text-gray-800 text-base leading-relaxed whitespace-pre-line">
                        {currentBlock.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <>
                    <div className="bg-transparent rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-4">
                      <div className="text-gray-600 text-sm mb-4">
                        Question {questionData.number} sur {questionData.total}
                      </div>
                      <div className="text-gray-800 text-base leading-relaxed mb-4">
                        {questionData.question}
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {questionData.options.map((option, index) => {
                        const isSelected = selectedAnswer === option.letter;
                        const isWrong = showError && isSelected;
                        const optionStateClass = isWrong
                          ? 'border-red-500 bg-transparent'
                          : isSelected
                          ? 'border-[#8B5CF6] bg-transparent'
                          : 'border-gray-200 bg-transparent hover:border-[#8B5CF6]';
                        return (
                          <button
                            key={index}
                            onClick={() => handleAnswerSelect(option.letter)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${optionStateClass}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`font-bold text-lg ${
                                isWrong ? 'text-red-500' : 'text-[#8B5CF6]'
                              }`}>
                                {option.letter})
                              </span>
                              <span className="flex-1 text-gray-800">{option.text}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {showError && (
                      <div className="border-2 rounded-xl p-4 mb-4 bg-transparent border-red-200">
                        <div className="flex items-center gap-2 text-red-500">
                          <span>❌</span>
                          <span className="font-semibold">Mauvaise réponse, réessayer.</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Explanation Block (affichage normal, avec cartes) */}
              {!simplifyNoCards && isExplanationBlock && (() => {
                const explanation = parseExplanation(currentBlock.content);
                const explanationText = explanation.explanation
                  ? (explanation.correctAnswer
                      ? explanation.explanation.split('\n').filter((line) => {
                          const t = line.trim();
                          if (!t.includes('Réponse correcte') && !t.includes('Bonne réponse')) return true;
                          const after = t.replace(/^.*(?:Réponse correcte|Bonne réponse)\s*:\s*([a-d]\)\s*)?/i, '').trim();
                          return after !== explanation.correctAnswer.trim();
                        }).join('\n')
                      : explanation.explanation)
                  : null;
                return (
                  <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
                    <div className="space-y-4">
                      {explanation.correctAnswer && (
                        <div className={`rounded-xl p-4 border ${isDarkTheme ? 'bg-[#1e293b] border-green-600/60' : 'bg-green-50/80 border-green-200'}`}>
                          <div className="flex items-start gap-3">
                            <span className="text-green-500 text-xl">✅</span>
                            <div className="flex-1">
                              <div className={`font-semibold mb-1 ${isDarkTheme ? 'text-green-400' : 'text-green-700'}`}>Réponse correcte :</div>
                              <div className={`font-medium ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>{explanation.correctAnswer}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {explanationText && (
                        <div className="text-gray-800 text-base leading-relaxed space-y-4">
                          {parseContentWithImages(explanationText).map((seg, i) =>
                            seg.type === 'image' ? (
                              <img
                                key={i}
                                src={seg.src}
                                alt={seg.alt}
                                className="w-full rounded-xl object-contain max-h-72"
                              />
                            ) : seg.type === 'pill' ? (
                              <div
                                key={i}
                                className={`block w-full rounded-xl border-2 bg-transparent px-4 py-3 font-medium whitespace-pre-line ${
                                  seg.variant === 'orange' ? 'border-[#d4a574] text-gray-800' : seg.variant === 'green' ? 'border-green-600 text-gray-800' : seg.variant === 'blue' ? 'border-blue-500 text-gray-800' : 'border-gray-300 text-gray-800'
                                }`}
                              >
                                {renderPillContent(seg.value)}
                              </div>
                            ) : (
                              <div key={i} className="whitespace-pre-line">
                                {formatContent(seg.value).map((para, j) => (
                                  <div key={j} className={j > 0 ? 'mt-3' : ''}>
                                    {renderParagraphWithInlineBadges(para)}
                                  </div>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {explanation.additionalInfo && explanation.additionalInfo.length > 0 && (
                      <div className="space-y-3">
                        {explanation.additionalInfo.map((info, index) => {
                          const titleMatch = info.match(/^([^:]+):\s*(.+)$/s);
                          const title = titleMatch ? titleMatch[1].trim() : null;
                          const content = titleMatch ? titleMatch[2].trim() : info;
                          return (
                            <div key={index} className="bg-transparent rounded-2xl shadow-lg border-2 border-gray-200 p-6">
                              {title && (
                                <div className="font-semibold text-gray-900 mb-3">{title} :</div>
                              )}
                              <div className="text-gray-800 text-base leading-relaxed whitespace-pre-line">
                                {formatContent(content).join('\n\n')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {explanation.toRemember && (
                      <div className="border-2 rounded-xl p-4 bg-transparent border-blue-200">
                        <div className="font-semibold mb-2 text-blue-700">À retenir :</div>
                        <div className="text-gray-800 text-base leading-relaxed space-y-3">
                          {parseContentWithImages(explanation.toRemember.replace(/^\s*À retenir\s*:\s*/i, '').trim()).map((seg, i) =>
                            seg.type === 'pill' ? (
                              <div
                                key={i}
                                className={`block w-full rounded-xl border-2 bg-transparent px-4 py-3 font-medium whitespace-pre-line ${
                                  seg.variant === 'orange' ? 'border-[#d4a574] text-gray-800' : seg.variant === 'green' ? 'border-green-600 text-gray-800' : seg.variant === 'blue' ? 'border-blue-500 text-gray-800' : 'border-gray-300 text-gray-800'
                                }`}
                              >
                                {renderPillContent(seg.value)}
                              </div>
                            ) : (
                              <div key={i} className="whitespace-pre-line">
                                {formatContent(seg.value).map((para, j) => (
                                  <div key={j} className={j > 0 ? 'mt-2' : ''}>
                                    {renderParagraphWithInlineBadges(para)}
                                  </div>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Regular Content Block */}
              {!isQuestionBlock && !isExplanationBlock && (
                <>
                <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 mb-6 space-y-4">
                  {parseContentWithImages(isCommunityBlock ? currentBlock.content.replace(/\n*Rejoins-nous\s*!\s*$/i, '').trim() : currentBlock.content).map((seg, i) =>
                    seg.type === 'image' ? (
                      <img
                        key={i}
                        src={seg.src}
                        alt={seg.alt}
                        className="w-full rounded-xl object-contain max-h-72"
                      />
                    ) : seg.type === 'pill' ? (
                      <div
                        key={i}
                        className={`block w-full rounded-xl border-2 bg-transparent px-4 py-3 font-medium whitespace-pre-line ${
                          seg.variant === 'orange' ? 'border-[#d4a574] text-gray-800' : seg.variant === 'green' ? 'border-green-600 text-gray-800' : seg.variant === 'blue' ? 'border-blue-500 text-gray-800' : 'border-gray-300 text-gray-800'
                        }`}
                      >
                        {renderPillContent(seg.value)}
                      </div>
                    ) : (
                      <div key={i} className="text-gray-800 text-base leading-relaxed whitespace-pre-line">
                        {formatContent(seg.value).map((para, j) => (
                          <div key={j} className={j > 0 ? 'mt-3' : ''}>
                            {renderParagraphWithInlineBadges(para)}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
                {isCommunityBlock && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowCommunityModal(true)}
                      className="w-full max-w-xs py-3 px-6 rounded-xl bg-[#8B5CF6] text-white font-semibold shadow-lg hover:opacity-90 transition-opacity"
                    >
                      Rejoins-nous
                    </button>
                  </div>
                )}
              </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bear Mascot Button */}
      <div className="absolute right-4 bottom-24 z-20 animate-bounce" style={{ maxWidth: 'calc(100% - 2rem)' }}>
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
          <span className="text-4xl hidden">🐻</span>
        </div>
      </div>

      {/* Bottom Buttons — safe area on mobile so they sit above native nav bar */}
      <div className="w-full flex-shrink-0 bg-white px-4 py-4 border-t border-gray-200 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-3">
          {isIntroPage ? (
            <button
              onClick={handleStartLesson}
              className="w-full bg-[#8B5CF6] text-white font-bold py-4 rounded-xl hover:bg-[#7C3AED] transition-colors shadow-lg active:scale-95"
            >
              Commencer la leçon
            </button>
          ) : isEndPage ? (
            <button
              onClick={handleFinishLesson}
              className="w-full bg-[#8B5CF6] text-white font-bold py-4 rounded-xl hover:bg-[#7C3AED] transition-colors shadow-lg active:scale-95"
            >
              Terminer
            </button>
          ) : showingQuizPause ? (
            <>
              <button
                onClick={handlePrevious}
                className="flex-1 font-bold py-4 rounded-xl transition-colors shadow-lg active:scale-95 bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-[#8B5CF6] text-white font-bold py-4 rounded-xl hover:bg-[#7C3AED] transition-colors shadow-lg active:scale-95"
              >
                C'est parti !
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePrevious}
                disabled={currentBlockIndex === 0}
                className={`flex-1 font-bold py-4 rounded-xl transition-colors shadow-lg active:scale-95 ${
                  currentBlockIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Retour
              </button>
              
              <button
                onClick={handleNext}
                className="flex-1 bg-[#8B5CF6] text-white font-bold py-4 rounded-xl hover:bg-[#7C3AED] transition-colors shadow-lg active:scale-95"
              >
                {isQuestionBlock && showError 
                  ? 'Réessayer' 
                  : isLastBlock 
                  ? 'Terminer' 
                  : 'Suivant'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal fin de leçon : message de félicitation si streak augmenté */}
      {showLessonCompleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={handleCloseLessonCompleteModal}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
            {showStreakCongrats ? (
              <>
                <div className="text-6xl mb-4">🔥</div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                  Bravo, tu as fait ta leçon du jour !
                </h2>
                <p className="text-gray-600 mb-4">Ton streak continue. Garde le rythme !</p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl bg-green-100 text-green-800 text-sm font-semibold">+{xpPerLesson} XP</span>
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl bg-amber-100 text-amber-800 text-sm font-semibold">−{energyPerLesson} énergie</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Leçon terminée !</h2>
                <p className="text-gray-600 mb-4">À bientôt pour la suite.</p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl bg-green-100 text-green-800 text-sm font-semibold">+{xpPerLesson} XP</span>
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl bg-amber-100 text-amber-800 text-sm font-semibold">−{energyPerLesson} énergie</span>
                </div>
              </>
            )}
            <button
              onClick={handleCloseLessonCompleteModal}
              className="w-full bg-[#8B5CF6] text-white font-bold py-4 rounded-xl hover:bg-[#7C3AED] transition-colors"
            >
              Super !
            </button>
          </div>
        </div>
      )}

      {/* Modal « Notre communauté » : communauté WhatsApp en construction */}
      {showCommunityModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55] p-4"
          onClick={() => setShowCommunityModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border-2 border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-3">🚧</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Communauté en construction</h3>
            <p className="text-gray-600 text-sm mb-6">
              La communauté WhatsApp TheBudge est en cours de déploiement. Elle sera bientôt disponible !
            </p>
            <button
              type="button"
              onClick={() => setShowCommunityModal(false)}
              className="w-full bg-[#8B5CF6] text-white font-semibold py-3 rounded-xl hover:bg-[#7C3AED] transition-colors"
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* Chatbot Modal - Same as in LearningPathScreen */}
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

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 scrollbar-hide" ref={messagesContainerRef}>
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
    </div>
  );
};

export default LessonScreen;
