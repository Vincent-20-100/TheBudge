export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: Array<{ type: 'image' | 'pdf'; name: string; data: string }>;
}

export interface ChatbotResponse {
  text: string;
  grounded?: boolean;
  sourcesCount?: number;
  sources?: Array<{ title: string; uri: string }>;
  retrievalQueries?: string[];
}

/**
 * Supprime le markdown simple d'un texte
 * Remplace **texte** par texte (gras), *texte* par texte (italique), etc.
 */
export function removeMarkdown(text: string): string {
  if (!text) return text;
  
  return text
    // Supprimer les headers markdown (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Supprimer le gras **texte** ou __texte__
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Supprimer l'italique *texte* ou _texte_ (mais garder ceux qui ne sont pas en début/fin de mot)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1')
    // Supprimer le code inline `code`
    .replace(/`([^`]+)`/g, '$1')
    // Supprimer les liens [texte](url)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Supprimer les listes markdown (- * +)
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    // Supprimer les numéros de liste (1. 2. etc.) mais garder le contenu
    .replace(/^\d+\.\s+/gm, '')
    // Nettoyer les espaces multiples
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class ChatbotService {
  // URL du backend Cloud Run - peut être configurée via VITE_CLOUD_RUN_URL dans .env.local
  private getCloudRunUrl(): string {
    // @ts-ignore - Vite injecte les variables d'environnement
    return import.meta.env.VITE_CLOUD_RUN_URL || "https://thebudge-coach-603894637952.europe-west9.run.app";
  }

  public async sendMessage(
    userMessage: string, 
    conversationHistory: ChatMessage[] = [],
    options?: {
      capsuleId?: string;
      blockId?: string;
      blockText?: string;
      mode?: 'help' | 'explain' | 'example' | 'error';
      quiz?: any;
      files?: Array<{ type: 'image' | 'pdf'; name: string; data: string }>;
    }
  ): Promise<string> {
    try {
      const cloudRunUrl = this.getCloudRunUrl();
      console.log("Sending message to Cloud Run backend...", cloudRunUrl);
      
      // Construire le payload selon le format attendu par Cloud Run
      const payload: any = {
        mode: options?.mode || 'help',
        message: userMessage,
        capsuleId: options?.capsuleId || '',
        blockId: options?.blockId || '',
        blockText: options?.blockText || '',
        quiz: options?.quiz || {}
      };

      // Ajouter les fichiers si présents
      if (options?.files && options.files.length > 0) {
        payload.files = options.files.map(file => ({
          type: file.type,
          name: file.name,
          data: file.data // base64 data URL
        }));
        console.log(`📎 Envoi de ${options.files.length} fichier(s) au backend:`, options.files.map(f => ({ type: f.type, name: f.name, dataLength: f.data.length })));
      } else {
        console.log("📎 Aucun fichier à envoyer");
      }

      console.log("📤 Payload complet:", { 
        ...payload, 
        files: payload.files ? `${payload.files.length} fichier(s)` : 'aucun' 
      });

      const response = await fetch(cloudRunUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        
        // Essayer de parser l'erreur pour un message plus lisible
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.text) {
            // Le backend a renvoyé une erreur formatée dans le champ text
            throw new Error(errorJson.text);
          }
        } catch (e) {
          // Si ce n'est pas du JSON, utiliser le texte brut
        }
        
        throw new Error(`Erreur HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data: ChatbotResponse = await response.json();
      console.log("Response data:", data);

      if (!data.text) {
        throw new Error("Réponse invalide du backend - aucun texte trouvé");
      }

      // Nettoyer le markdown avant de retourner
      return removeMarkdown(data.text);
    } catch (error: any) {
      console.error("Error sending message to chatbot:", error);
      console.error("Error details:", {
        message: error?.message,
        stack: error?.stack
      });
      
      // Gérer les erreurs réseau
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        throw new Error("Impossible de se connecter au serveur. Vérifiez votre connexion internet.");
      }
      
      // Gérer les autres erreurs
      const errorMessage = error?.message || "Erreur lors de la communication avec l'IA. Veuillez réessayer.";
      throw new Error(errorMessage);
    }
  }
}

export const chatbotService = new ChatbotService();
