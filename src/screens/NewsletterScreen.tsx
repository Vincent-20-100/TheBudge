import React, { useState, useEffect } from 'react';
import { useUserProgress } from '../contexts/UserProgressContext';
import Header from '../components/Header';
import { newsService, ProcessedArticle, SelectedTopic } from '../services/NewsAggregatorService';
import { supabase } from '../services/supabaseClient';
import { getWeekDays } from '../utils/progressUtils';
import { fetchPreferences, upsertPreferences, saveHistory, updateSatisfaction, fetchHistory, NewsletterHistoryEntry } from '../services/NewsletterService';

interface Node {
  id: string;
  label: string;
  icon?: React.ReactElement;
  children?: Node[];
}

const STORAGE_KEY = 'USER_NEWSLETTER_SELECTIONS';
const DATA_STORAGE_KEY = 'USER_NEWSLETTER_DATA_CACHE';

// Composant Skeleton pour l'attente (Design "Fantôme")
const SkeletonArticle = () => (
  <div className="p-6 rounded-[2.5rem] bg-white border border-white shadow-sm animate-pulse mb-4">
    <div className="flex justify-between items-center mb-4">
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-slate-100 rounded-md"></div>
      </div>
      <div className="h-3 w-16 bg-slate-50 rounded"></div>
    </div>
    <div className="h-6 w-3/4 bg-slate-100 rounded-lg mb-2"></div>
    <div className="h-6 w-1/2 bg-slate-100 rounded-lg mb-5"></div>
    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100/50">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-slate-200"></div>
        <div className="h-3 w-24 bg-slate-200 rounded"></div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-slate-200 rounded"></div>
        <div className="h-3 w-5/6 bg-slate-200 rounded"></div>
      </div>
    </div>
  </div>
);

const TREE: Node[] = [
  {
    id: "immo", label: "Immobilier",
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    children: [
      { id: "immo_prix", label: "Prix & Tendances", children: [
          { id: "immo_fr", label: "France (National)" },
          { id: "reg_ara", label: "Auvergne-Rhône-Alpes" },
          { id: "reg_bfc", label: "Bourgogne-Franche-Comté" },
          { id: "reg_bre", label: "Bretagne" },
          { id: "reg_cvl", label: "Centre-Val de Loire" },
          { id: "reg_cor", label: "Corse" },
          { id: "reg_ges", label: "Grand Est" },
          { id: "reg_hdf", label: "Hauts-de-France" },
          { id: "reg_idf", label: "Île-de-France" },
          { id: "reg_nor", label: "Normandie" },
          { id: "reg_naq", label: "Nouvelle-Aquitaine" },
          { id: "reg_occ", label: "Occitanie" },
          { id: "reg_pdl", label: "Pays de la Loire" },
          { id: "reg_paca", label: "Provence-Alpes-Côte d'Azur" },
      ]},
      { id: "immo_scpi", label: "SCPI & Investissement" },
      { id: "immo_taux", label: "Crédit & Taux" },
      { id: "immo_loi", label: "Lois & Fiscalité" },
    ]
  },
  {
    id: "bourse", label: "Bourse & Marchés",
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    children: [
      { id: "b_act", label: "ACTIONS", children: [
        { id: "a_tech", label: "Technologie / IA" }, { id: "a_lux", label: "Luxe" }, { id: "a_sant", label: "Santé & Pharma" },
        { id: "a_en", label: "Énergie & Industrie" }, { id: "a_def", label: "Défense" }, { id: "a_fin", label: "Finance" }
      ]},
      { id: "b_etf", label: "ETFs", children: [
        { id: "e_sp", label: "S&P 500" }, { id: "e_nas", label: "NASDAQ-100" }, { id: "e_mw", label: "MSCI World" }, { id: "e_cac", label: "CAC 40" }
      ]},
      { id: "b_mp", label: "Matières Premières", children: [
        { id: "mp_en", label: "Énergie", children: [{id:"mp_p", label:"Pétrole brut"}, {id:"mp_g", label:"Gaz naturel"}, {id:"mp_ur", label:"Uranium"}]},
        { id: "mp_prec", label: "Métaux précieux", children: [{id:"m_or", label:"Or"}, {id:"m_ag", label:"Argent"}]},
      ]}
    ]
  },
  {
    id: "crypto", label: "Crypto & Web3",
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8l-4 4 4 4 4-4-4-4z"/></svg>,
    children: [
      { id: "c_be", label: "Bitcoin & Ether", children: [{id:"c_btc", label:"Bitcoin (BTC)"}, {id:"c_eth", label:"Ethereum (ETH)"}]},
      { id: "c_alt", label: "Altcoins", children: [{id:"c_sol", label:"Solana"}, {id:"c_ai", label:"IA & Crypto"}]},
      { id: "c_reg", label: "Régulation", children: [{id:"c_mica", label:"MiCA / Europe"}, {id:"c_sec", label:"SEC / USA"}]}
    ]
  },
  {
    id: "macro", label: "Macro & Géopolitique",
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>,
    children: [
      { id: "m_bc", label: "Banques Centrales", children: [{id:"bc_fed", label:"FED"}, {id:"bc_bce", label:"BCE"}]},
      { id: "m_ind", label: "Indicateurs", children: [{id:"i_inf", label:"Inflation"}, {id:"i_cro", label:"Croissance"}]},
      { id: "m_geo", label: "Géopolitique", children: [{id:"g_conf", label:"Conflits / Tensions"}, {id:"g_diplo", label:"Diplomatie"}]}
    ]
  },
  {
    id: "epargne", label: "Patrimoine",
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    children: [
      { id: "e_liv", label: "Épargne Réglementée" },
      { id: "e_av", label: "Assurance-vie" },
      { id: "e_fis", label: "Fiscalité" }
    ]
  }
];

const NewsletterScreen: React.FC = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains('dark-theme'));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Header modals
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showDiamondsModal, setShowDiamondsModal] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showBoostPromoModal, setShowBoostPromoModal] = useState(false);

  const { progress } = useUserProgress();
  const { streak, diamonds, energy, maxEnergy, lastLessonDate } = progress;

  const [userId, setUserId] = useState<string | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [hasSatisfied, setHasSatisfied] = useState(false);
  const [history, setHistory] = useState<NewsletterHistoryEntry[]>([]);

  // Récupère le userId depuis la session Supabase au montage
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // Charge l'historique quand userId est disponible
  useEffect(() => {
    if (!userId) return;
    fetchHistory(userId).then(setHistory);
  }, [userId]);

  // 1. Initialisation des sélections depuis le stockage local
  const [selections, setSelections] = useState<SelectedTopic[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load selections", e);
      return [];
    }
  });

  const hasSavedSelections = selections.length > 0;

  // 2. Initialisation intelligente des états
  const [navStack, setNavStack] = useState<Node[]>([]);
  // Si on a des sélections, on part du principe qu'on va afficher le FEED (soit cache, soit loading)
  const [viewState, setViewState] = useState<'FORM' | 'FEED' | 'HISTORY'>(hasSavedSelections ? 'FEED' : 'FORM');
  const [isLoading, setIsLoading] = useState(false); 
  
  const [loadingProgress, setLoadingProgress] = useState(5); 
  const [loadingLabel, setLoadingLabel] = useState("");
  const [articles, setArticles] = useState<ProcessedArticle[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const currentNode = navStack.length > 0 ? navStack[navStack.length - 1] : null;
  const currentOptions = currentNode ? currentNode.children : TREE;

  // Charge les préférences Supabase dès que userId est disponible (priorité sur localStorage)
  useEffect(() => {
    if (!userId) return;
    fetchPreferences(userId).then(remote => {
      if (remote && remote.length > 0) setSelections(remote);
    });
  }, [userId]);

  // Sauvegarde automatique (localStorage + Supabase si connecté)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
    if (userId && selections.length > 0) upsertPreferences(userId, selections);
  }, [selections, userId]);

  const runAnalysis = async (topics: SelectedTopic[]) => {
    setViewState('FEED');
    setIsLoading(true);
    setLoadingProgress(5); 
    setLoadingLabel("Initialisation...");
    setArticles([]);

    try {
      const data = await newsService.getDailyDatabase(topics, (completed, total, lastProcessed) => {
        const percentage = Math.max(5, (completed / total) * 100);
        setLoadingProgress(percentage);
        setLoadingLabel(lastProcessed);
      });
      setArticles(data);
      setCurrentHistoryId(null);
      setHasSatisfied(false);

      // Sauvegarde du cache avec la date du jour
      const today = new Date().toDateString();
      localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({
        date: today,
        articles: data
      }));

      // Enregistrement en base (fire-and-forget)
      if (userId) {
        saveHistory(userId, topics, data).then(id => setCurrentHistoryId(id));
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setLoadingProgress(100);
    }
  };

  // 3. Effet de démarrage automatique avec gestion du CACHE
  useEffect(() => {
    if (selections.length > 0) {
      // Vérification du cache
      const cacheStr = localStorage.getItem(DATA_STORAGE_KEY);
      let loadedFromCache = false;
      
      if (cacheStr) {
        try {
          const cache = JSON.parse(cacheStr);
          const today = new Date().toDateString();
          
          if (cache.date === today && Array.isArray(cache.articles) && cache.articles.length > 0) {
            console.log("Loading from cache for today:", today);
            setArticles(cache.articles);
            setViewState('FEED');
            setIsLoading(false);
            setLoadingProgress(100);
            loadedFromCache = true;
          }
        } catch (e) {
          console.error("Cache parsing error", e);
        }
      }

      // Si pas de cache valide pour aujourd'hui, on lance l'analyse
      if (!loadedFromCache) {
        // Petit délai pour laisser l'UI se monter
        setIsLoading(true); // On force le loading tout de suite pour éviter le flash
        setTimeout(() => runAnalysis(selections), 100);
      }
    }
  }, []); // Exécuté une seule fois au montage

  const toggleSelection = (node: Node) => {
    setSelections(prev => {
      const exists = prev.find(s => s.label === node.label);
      if (exists) return prev.filter(s => s.label !== node.label);
      const path = [...navStack.map(n => n.label), node.label];
      return [...prev, { path, label: node.label }];
    });
  };

  const isSelected = (label: string) => selections.some(s => s.label === label);
  const goBack = () => setNavStack(prev => prev.slice(0, -1));

  const handleGenerate = async () => {
    if (selections.length === 0) return;
    runAnalysis(selections);
  };

  function handleSatisfaction(satisfied: boolean) {
    if (!currentHistoryId || hasSatisfied) return;
    setHasSatisfied(true);
    updateSatisfaction(currentHistoryId, satisfied);
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function loadFromHistory(entry: NewsletterHistoryEntry) {
    setArticles(entry.articles);
    setCurrentHistoryId(entry.id);
    setHasSatisfied(entry.satisfaction !== null);
    setActiveTab(null);
    setViewState('FEED');
  }

  if (viewState === 'FEED') {
    const feedFiltered = activeTab ? articles.filter(a => a.categoryPath === activeTab) : articles;
    const uniqueTabs = Array.from(new Set(articles.map(a => a.categoryPath)));

    return (
      <div className="flex flex-col h-full w-full bg-white relative">
        <div className="relative z-30">
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
        </div>
        
        {/* SUB-NAV */}
        <div className="flex gap-2 px-4 pt-4 pb-3 bg-white shrink-0">
          <button
            onClick={() => { setViewState('FORM'); setNavStack([]); }}
            className="flex-1 py-3 rounded-[2.5rem] text-sm font-bold bg-gray-100 text-gray-500 active:scale-95 transition-all"
          >
            Newsletter
          </button>
          <button
            onClick={() => setViewState('HISTORY')}
            className="flex-1 py-3 rounded-[2.5rem] text-sm font-bold bg-gray-100 text-gray-500 active:scale-95 transition-all"
          >
            Historique
          </button>
        </div>

        {/* HEADER FIXE - Ne scroll pas */}
        <div className="px-4 pb-3 border-b border-gray-200 bg-white shrink-0 relative z-20">
          {uniqueTabs.length > 0 && !isLoading && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <button onClick={() => setActiveTab(null)} className={`px-3 py-1.5 rounded-[2.5rem] text-xs font-semibold transition-all flex-shrink-0 ${!activeTab ? 'bg-[#8B5CF6] text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>Synthèse</button>
              {uniqueTabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-[2.5rem] text-xs font-semibold transition-all flex-shrink-0 ${activeTab === tab ? 'bg-[#8B5CF6] text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>{tab}</button>
              ))}
            </div>
          )}
          
          {/* Indicateur de chargement intégré au header */}
          {isLoading && (
             <div className="mt-2">
                <div className="flex justify-between items-end mb-1.5">
                    <span className="text-xs font-semibold text-[#8B5CF6] animate-pulse">
                        {loadingLabel ? `Analyse : ${loadingLabel}` : 'Connexion aux flux...'}
                    </span>
                    <span className="text-xs font-bold text-gray-400 font-mono">
                        {Math.round(loadingProgress)}%
                    </span>
                </div>
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-[#8B5CF6] transition-all duration-500 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                    ></div>
                </div>
             </div>
          )}
        </div>
        
        {/* CONTENU SCROLLABLE - Indépendant */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 scrollbar-hide">
          {isLoading ? (
            // VUE SKELETON (Chargement "fantôme")
            <div className="animate-in fade-in duration-500">
               {/* On génère 3 squelettes pour simuler une liste */}
               <SkeletonArticle />
               <SkeletonArticle />
               <SkeletonArticle />
            </div>
          ) : feedFiltered.length > 0 ? (
            feedFiltered.map((art, idx) => (
              <article key={art.id} className="p-4 rounded-[2.5rem] bg-white border border-gray-200 shadow-sm active:scale-[0.98] transition-all" onClick={() => window.open(art.sourceUrl, '_blank')}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-[#8B5CF6] uppercase bg-[#8B5CF6]/10 px-2 py-1 rounded-[2.5rem]">{art.categoryPath}</span>
                    {art.tag === 'SECTEUR' && (
                        <span className="text-xs font-semibold text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded-[2.5rem]">Marché Global</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-400 uppercase">{art.source}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-[2.5rem] border border-gray-100">
                  <p className="text-sm font-bold text-gray-900 leading-tight">{art.title}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center px-10">
              <p className="text-gray-900 text-sm font-bold mb-1">Aucune donnée</p>
              <p className="text-gray-400 text-xs font-semibold">Impossible de récupérer des informations pertinentes pour le moment.</p>
            </div>
          )}

          {/* Boutons satisfaction — après chargement complet ; marge basse pour rester visible au-dessus du menu (mobile + PC) */}
          {!isLoading && articles.length > 0 && currentHistoryId && (
            <div className="flex flex-col items-center gap-2 py-4 pb-24 md:pb-20">
              {!hasSatisfied ? (
                <>
                  <p className="text-xs text-gray-400">Cette sélection était utile ?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSatisfaction(true)}
                      className="px-4 py-2 rounded-[2.5rem] border border-gray-200 text-sm hover:bg-green-50 hover:border-green-300 transition-colors"
                    >
                      👍 Utile
                    </button>
                    <button
                      onClick={() => handleSatisfaction(false)}
                      className="px-4 py-2 rounded-[2.5rem] border border-gray-200 text-sm hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      👎 Pas utile
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Merci pour votre retour !</p>
              )}
            </div>
          )}
        </div>

        {/* Modals - must be in FEED view too */}
        {showStreakModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
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
              <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">Streak</h3>
              <p className="text-sm text-gray-600 text-center mb-4">Complétez une leçon chaque jour pour maintenir votre streak.</p>
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
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
              <p className="text-sm text-gray-600 text-center mb-4">
                Les diamants peuvent être utilisés pour recharger votre énergie, accéder à des leçons spéciales ou légendaires, ou acheter des skins pour votre avatar (fonctionnalité à venir).
              </p>
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
            onClick={() => setShowEnergyModal(false)}
          >
            <div
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Énergie</h3>
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

        {showBoostModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
            onClick={() => setShowBoostModal(false)}
          >
            <div
              className="bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 rounded-[2.5rem] shadow-2xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-white text-center mb-6">Choisissez un plan</h3>
              
              <div className="space-y-3 mb-4">
                <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">Plan Familial</p>
                      <p className="text-sm text-gray-300">12 mois • 108,99 €</p>
                    </div>
                    <p className="text-lg font-bold">8,99 € / MO</p>
                  </div>
                </div>

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

        {showBoostPromoModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
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
  }

  if (viewState === 'HISTORY') {
    return (
      <div className="flex flex-col h-full w-full bg-white">
        <div className="relative z-30">
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
        </div>

        <div className="flex gap-2 px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
          <button
            onClick={() => { setViewState('FORM'); setNavStack([]); }}
            className="flex-1 py-3 rounded-[2.5rem] text-sm font-bold bg-gray-100 text-gray-500 active:scale-95 transition-all"
          >
            Newsletter
          </button>
          <button
            className="flex-1 py-3 rounded-[2.5rem] text-sm font-bold bg-[#8B5CF6] text-white active:scale-95 transition-all"
          >
            Historique
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-10">
              <p className="text-gray-900 text-sm font-bold mb-1">Aucune recherche</p>
              <p className="text-gray-400 text-xs font-semibold">Vos analyses précédentes apparaîtront ici.</p>
            </div>
          ) : (
            history.map(entry => (
              <button
                key={entry.id}
                onClick={() => loadFromHistory(entry)}
                className="w-full text-left p-4 rounded-[2.5rem] border border-gray-200 bg-white active:scale-[0.98] transition-all hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold">{formatDate(entry.createdAt)}</span>
                  <span className="text-base">
                    {entry.satisfaction === true ? '👍' : entry.satisfaction === false ? '👎' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.topics.slice(0, 5).map(t => (
                    <span key={t.label} className="text-xs font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded-[2.5rem]">
                      {t.label}
                    </span>
                  ))}
                  {entry.topics.length > 5 && (
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-[2.5rem]">
                      +{entry.topics.length - 5}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDarkTheme ? 'bg-[#0B1220]' : 'bg-white'}`}>
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

      {/* SUB-NAV */}
      <div className="flex gap-2 px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
        <button
          onClick={() => setNavStack([])}
          className="flex-1 py-3 rounded-[2.5rem] text-sm font-bold bg-[#8B5CF6] text-white active:scale-95 transition-all"
        >
          Newsletter
        </button>
        <button
          onClick={() => setViewState('HISTORY')}
          className="flex-1 py-3 rounded-[2.5rem] text-sm font-bold bg-gray-100 text-gray-500 active:scale-95 transition-all"
        >
          Historique
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Title Section */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            {selections.length > 0 && (
              <button onClick={() => setSelections([])} className="text-xs font-semibold text-red-500 bg-red-50 px-3 py-1.5 rounded-[2.5rem] border border-red-100 active:bg-red-100">Reset</button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            {navStack.length > 0 && (
              <button onClick={goBack} className="p-2 -ml-2 text-[#8B5CF6] bg-[#8B5CF6]/10 rounded-full active:scale-75 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            <h1 className={`text-lg font-bold ${isDarkTheme ? 'text-slate-100' : 'text-gray-900'}`}>
              {currentNode ? currentNode.label : "Sources"}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <button 
              onClick={() => setNavStack([])} 
              disabled={navStack.length === 0}
              className={`text-xs font-semibold transition-colors ${navStack.length === 0 ? 'text-[#8B5CF6]' : 'text-gray-400'}`}
            >
              Catalogue
            </button>
            {navStack.map((n, i) => {
              const isLast = i === navStack.length - 1;
              return (
                <React.Fragment key={n.id}>
                  <span className="text-gray-300 font-bold">/</span>
                  <button
                    onClick={() => {
                      if (!isLast) setNavStack(navStack.slice(0, i + 1));
                    }}
                    disabled={isLast}
                    className={`text-xs font-semibold transition-colors ${isLast ? 'text-[#8B5CF6]' : 'text-gray-400'}`}
                  >
                    {n.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-2 pb-36 md:pb-32">
          <div className={`${navStack.length === 0 ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2'}`}>
            {currentOptions?.map(node => {
              const isLeaf = !node.children;
              const selected = isSelected(node.label);
              return (
                <button 
                  key={node.id} 
                  onClick={() => isLeaf ? toggleSelection(node) : setNavStack([...navStack, node])}
                  className={`flex items-center transition-all text-left group ${
                    navStack.length === 0 
                    ? `flex-col justify-center p-3 h-24 rounded-[2.5rem] border-2 shadow-sm ${selected ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-[#8B5CF6]/20' : 'bg-white border-gray-200 text-gray-900 active:scale-95'}` 
                    : `p-4 rounded-[2.5rem] border-2 ${selected ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white' : 'bg-white border-gray-200 text-gray-900 active:bg-gray-50'}`
                  }`}
                >
                  {node.icon && (
                    <div className={`mb-1 transition-colors ${selected ? 'text-white' : 'text-gray-400 group-active:text-[#8B5CF6]'}`}>
                      {node.icon}
                    </div>
                  )}
                  <div className="flex-1">
                    <span className={`block font-semibold tracking-tight leading-tight ${navStack.length === 0 ? 'text-sm text-center' : 'text-sm'}`}>
                      {node.label}
                    </span>
                  </div>
                  {isLeaf && selected && (
                    <div className="bg-white/20 p-1.5 rounded-full ml-2">
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  {!isLeaf && (
                    <svg className={`w-4 h-4 ml-2 ${selected ? 'text-white/40' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Button pinned above tab bar */}
        <div
          className={`absolute left-0 right-0 bottom-[72px] md:bottom-[92px] px-4 py-2.5 z-20 ${
            isDarkTheme
              ? 'bg-gradient-to-t from-[#0B1220] via-[#0B1220]/95 to-transparent'
              : 'bg-gradient-to-t from-white via-white/95 to-transparent border-t border-gray-100'
          }`}
        >
          <button
            onClick={handleGenerate}
            disabled={selections.length === 0 || isLoading}
            className={`w-full py-3.5 rounded-[2.5rem] font-bold text-sm text-white transition-all active:scale-[0.98] shadow-md ${
              selections.length > 0
                ? 'bg-[#8B5CF6] shadow-[#8B5CF6]/20'
                : isDarkTheme
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'ANALYSE EN COURS...' : `LANCER L'ANALYSE (${selections.length})`}
          </button>
        </div>
      </div>

      {/* Modals - same as other screens */}
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
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">Streak</h3>
            <p className="text-sm text-gray-600 text-center mb-4">Complétez une leçon chaque jour pour maintenir votre streak.</p>
            <div className="flex justify-between items-center mb-4">
              {getWeekDays(lastLessonDate, streak).map(({ label, checked }, index) => (
                <div key={index} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{label}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    checked ? 'bg-orange-500' : 'bg-gray-300'
                  }`}>
                    {checked ? (
                      <span className="text-white text-xs">✓</span>
                    ) : (
                      <span className="text-gray-500 text-xs">✗</span>
                    )}
                  </div>
                </div>
              ))}
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
            <p className="text-sm text-gray-600 text-center mb-4">
              Les diamants peuvent être utilisés pour recharger votre énergie, accéder à des leçons spéciales ou légendaires, ou acheter des skins pour votre avatar (fonctionnalité à venir).
            </p>
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
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Énergie</h3>
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

      {/* Boost Modal - same as other screens */}
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
              <div className="bg-blue-800 rounded-[2.5rem] p-4 text-white relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">Plan Familial</p>
                    <p className="text-sm text-gray-300">12 mois • 108,99 €</p>
                  </div>
                  <p className="text-lg font-bold">8,99 € / MO</p>
                </div>
              </div>

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

export default NewsletterScreen;
