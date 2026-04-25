import { GoogleGenAI } from "@google/genai";

export interface SelectedTopic {
  path: string[];
  label: string;
}

export interface ProcessedArticle {
  id: string;
  categoryPath: string;
  title: string;
  summary: string;
  tag?: string; // CIBLE, SECTEUR, ou TENDANCE
  source: string;
  sourceUrl: string;
  pubDate: string;
}

const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";
const PLACEHOLDER_SUMMARY = "Actualité récente (Sélection automatique).";
const MAX_INTRO_LENGTH = 200;

/**
 * Extrait la première phrase ou le début du corps de l'article (description/contenu RSS).
 * Pas le titre : on vise l'intro réelle. 1–2 lignes max.
 */
function getFirstSentenceFromItem(item: { content?: string; description?: string; contentSnippet?: string }): string {
  const raw = (item.contentSnippet || item.content || item.description || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return "";
  const firstSentence = stripped.split(/[.!?]\s+/)[0]?.trim() || "";
  const oneOrTwoLines = firstSentence
    ? (firstSentence.endsWith(".") ? firstSentence : firstSentence + ".").slice(0, MAX_INTRO_LENGTH)
    : stripped.slice(0, MAX_INTRO_LENGTH);
  return oneOrTwoLines.trim() || "";
}

class NewsAggregatorService {
  private ai: GoogleGenAI | null = null;

  private getAI() {
    if (!this.ai) {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined. Please set it in .env.local");
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  public async getDailyDatabase(
    selections: SelectedTopic[],
    onProgress?: (completed: number, total: number, lastProcessed: string) => void
  ): Promise<ProcessedArticle[]> {
    if (selections.length === 0) return [];
    
    let completedCount = 0;
    const total = selections.length;

    // On lance toutes les tâches en parallèle, mais on intercepte la fin de chacune
    // pour mettre à jour la progression
    const results = await Promise.all(
      selections.map(async (sel) => {
        const result = await this.processSingleTopic(sel);
        
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, total, sel.label);
        }
        
        return result;
      })
    );

    return results.flat().filter(a => !!a);
  }

  /**
   * Cœur de la logique : L'Agent de Recherche Hybride
   */
  private async processSingleTopic(sel: SelectedTopic): Promise<ProcessedArticle[]> {
    const ai = this.getAI();
    const fullPath = sel.path.join(" > ");
    const targetLabel = sel.label;
    // Nettoyage du parent (ex: "1. Immobilier" -> "Immobilier")
    const parentCategory = sel.path[0].replace(/^[0-9]+\.\s*/, '').trim(); 
    
    // Détection si c'est une sous-catégorie géographique ou spécifique
    const isSpecific = targetLabel.toLowerCase() !== parentCategory.toLowerCase();
    
    // Détection Géopolitique pour sources spécifiques
    const isGeopolitics = parentCategory.includes("Géopolitique") || targetLabel.includes("Géopolitique") || targetLabel.includes("Conflits") || targetLabel.includes("Diplomatie");

    // Détection Banques Centrales (FED / BCE)
    const isFed = targetLabel.toUpperCase() === "FED";
    const isBce = targetLabel.toUpperCase() === "BCE";

    // --- PHASE 1 : STRATÉGIE DE RECHERCHE ---
    
    const fetchPromises: Promise<any[]>[] = [];

    // A. Recherche Google News Standard ou Spécifique
    const queries = [];
    
    if (isFed) {
        // Stratégie spécifique FED : On cherche les taux et Powell
        queries.push(`"Réserve Fédérale" "FED" taux directeurs`);
        queries.push(`"Jerome Powell" discours politique monétaire`);
        queries.push(`"FED" inflation économie américaine`);
    } else if (isBce) {
        // Stratégie spécifique BCE : On cherche les taux et Lagarde
        queries.push(`"Banque Centrale Européenne" "BCE" taux directeurs`);
        queries.push(`"Christine Lagarde" discours politique monétaire`);
        queries.push(`"BCE" inflation zone euro`);
    } else {
        // Stratégie Standard
        queries.push(`"${targetLabel}" ${parentCategory}`); // Chirurgical
        if (isSpecific) {
            queries.push(`${targetLabel} ${parentCategory} actualité`);
            queries.push(`"${parentCategory}" marché tendances`);
        } else {
            queries.push(`${targetLabel} investissement économie`);
        }
    }

    queries.forEach((q, index) => {
        const timeframe = index === 0 ? "7d" : "3d";
        fetchPromises.push(this.fetchGoogleNewsFeed(q, timeframe, index));
    });

    // B. Sources Spécifiques (Geopolitique / ONU / Le Monde)
    if (isGeopolitics) {
        // Le Monde Géopolitique
        fetchPromises.push(this.fetchDirectRSS("https://www.lemonde.fr/geopolitique/rss_full.xml", "Le Monde", 0));
        // ONU Info (Nations Unies)
        fetchPromises.push(this.fetchDirectRSS("https://news.un.org/feed/subscribe/fr/news/all/rss.xml", "ONU Info", 0));
    }

    // --- PHASE 2 : COLLECTE (Fetching) ---
    const rawResults = await Promise.all(fetchPromises);
    const uniqueArticles = new Map<string, any>();

    rawResults.flat().forEach(item => {
        if (!uniqueArticles.has(item.link)) {
            uniqueArticles.set(item.link, item);
        }
    });

    // On convertit en liste et on trie par pertinence (Tier 0 = le plus pertinent)
    let candidates = Array.from(uniqueArticles.values())
        .sort((a, b) => a.relevanceTier - b.relevanceTier);

    // FILET DE SÉCURITÉ : Si vraiment rien, on va chercher une tendance globale
    if (candidates.length === 0) {
       const fallbackItems = await this.fetchGoogleNewsFeed(`${parentCategory} économie France`, "3d", 99);
       candidates = fallbackItems;
       if (candidates.length === 0) return []; // Abandon
    }

    // --- PHASE 3 : CURATION INTELLIGENTE (AI) ---

    try {
        // On prend un mix : le top des précis + quelques articles de contexte pour donner du choix à l'IA
        const selectionPool = candidates.slice(0, 30); // On augmente un peu le pool pour inclure les sources externes

        const contextList = selectionPool.map((a, i) => `[ID:${i}] [SOURCE:${a.source}] ${a.title}`).join('\n');

        // Instruction conditionnelle pour l'IA
        let logicInstruction = `2. Cherche une correspondance avec "${targetLabel}". (Tag = "CIBLE")`;
        
        if (isFed || isBce) {
            logicInstruction = `2. STRICTEMENT OBLIGATOIRE : L'article DOIT parler explicitement de la "${targetLabel}" (Banque Centrale) ou de ses décisions (Taux, Inflation, Dirigeants). Ignore les articles vagues qui citent juste l'acronyme.`;
        }

        const prompt = `
        Tu es un Analyste Financier et Géopolitique Senior.
        
        CONTEXTE CLIENT :
        Sujet demandé : "${targetLabel}"
        Secteur : "${parentCategory}"

        ARTICLES DISPONIBLES :
        ${contextList}

        TA MISSION (CRUCIALE) :
        Sélectionne les 2 articles les plus utiles, fiables et pertinents pour comprendre la situation actuelle.
        
        LOGIQUE DE DÉCISION :
        1. Priorité aux sources reconnues (Le Monde, ONU, Agences de presse) si le sujet est géopolitique.
        ${logicInstruction}
        3. À défaut, sélectionne un article majeur sur le SECTEUR "${parentCategory}". (Tag = "SECTEUR")
        
        RÉDACTION DE L'INSIGHT :
        - Synthétise l'information clé en 1 phrase percutante.
        - Ton factuel et expert.
        
        FORMAT JSON ATTENDU :
        [
            { "id": 0, "tag": "CIBLE", "insight": "Le conseil de sécurité adopte une nouvelle résolution sur..." }
        ]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // ou 'gemini-3-flash-preview' selon disponibilité
            contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.1 }
        });

        const curation = JSON.parse(response.text || "[]");

        return curation.map((c: any) => {
            const original = selectionPool[c.id];
            if (!original) return null;
            const summary = getFirstSentenceFromItem(original) || (c.insight && String(c.insight).trim()) || PLACEHOLDER_SUMMARY;
            return {
                id: Math.random().toString(36).substr(2, 9),
                categoryPath: sel.label,
                title: original.title,
                summary,
                tag: (c.tag ?? "SECTEUR") as string,
                source: original.source,
                sourceUrl: original.link,
                pubDate: original.pubDate,
            } as ProcessedArticle;
        }).filter((a: any) => a !== null);
    } catch (e) {
        console.error("AI Curation failed", e);
        if (candidates.length === 0) return [];
        const topCandidates = candidates.slice(0, 5);
        return topCandidates.map((item) => {
            const summary = getFirstSentenceFromItem(item) || PLACEHOLDER_SUMMARY;
            return {
                id: "fallback_" + Math.random().toString(36).substr(2, 9),
                categoryPath: sel.label,
                title: item.title,
                summary,
                tag: "SECTEUR" as const,
                source: item.source,
                sourceUrl: item.link,
                pubDate: item.pubDate,
            } as ProcessedArticle;
        });
    }
  }

  // Récupère via Google News (RSS Search)
  private async fetchGoogleNewsFeed(query: string, timeframe: string, tier: number): Promise<any[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:${timeframe}&hl=fr&gl=FR&ceid=FR:fr`;
    
    try {
      const res = await fetch(`${RSS2JSON_ENDPOINT}${encodeURIComponent(url)}`);
      const data = await res.json();
      
      if (data.status === 'ok' && Array.isArray(data.items)) {
        return data.items.map((i: any) => {
          let source = "Google News";
          let cleanTitle = i.title;
          // Google format: "Titre de l'article - Nom Source"
          const parts = i.title.split(' - ');
          if (parts.length > 1) {
            source = parts.pop()!.trim();
            cleanTitle = parts.join(' - ').trim();
          }
          return { ...i, title: cleanTitle, source: source, relevanceTier: tier };
        });
      }
      return [];
    } catch { return []; }
  }

  // Récupère un flux RSS direct standard (Le Monde, ONU, etc.)
  private async fetchDirectRSS(rssUrl: string, sourceName: string, tier: number): Promise<any[]> {
    try {
        const res = await fetch(`${RSS2JSON_ENDPOINT}${encodeURIComponent(rssUrl)}`);
        const data = await res.json();
        
        if (data.status === 'ok' && Array.isArray(data.items)) {
            return data.items.map((i: any) => ({
                ...i,
                source: sourceName, // On force le nom de la source car il n'est pas dans le titre RSS standard
                relevanceTier: tier
            }));
        }
        return [];
    } catch (e) {
        console.warn(`Failed to fetch RSS for ${sourceName}`, e);
        return [];
    }
  }
}

export const newsService = new NewsAggregatorService();

