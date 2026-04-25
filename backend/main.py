import os
import json
import logging
import base64
import re
from google import genai
from google.genai.types import (
    GenerateContentConfig,
    VertexAISearch,
    Retrieval,
    Tool,
    HttpOptions,
    Part,
)

# --- Config via env vars ---
DATASTORE_PATH = os.environ.get("DATASTORE_PATH")
# Modèle Gemini pour TheBudgeAI (qualité / coût équilibrés ; surcharge possible via GEMINI_MODEL)
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Client GenAI sur Vertex AI
client = genai.Client(http_options=HttpOptions(api_version="v1"))

# Tool de grounding vers Vertex AI Search - seulement si DATASTORE_PATH est défini
tool = None
if DATASTORE_PATH:
    try:
        tool = Tool(
            retrieval=Retrieval(
                vertex_ai_search=VertexAISearch(datastore=DATASTORE_PATH)
            )
        )
        logging.info(f"RAG activé avec DataStore: {DATASTORE_PATH}")
    except Exception as e:
        logging.warning(f"Impossible d'initialiser le RAG: {e}. Le chatbot fonctionnera sans RAG.")
        tool = None
else:
    logging.info("DATASTORE_PATH non défini. Le chatbot fonctionnera sans RAG.")

# Ton prompt système personnalisé
SYSTEM_INSTRUCTION = """Tu es The Budge Coach, un tuteur en finance personnelle pour le cours The Budge. Tu aides à comprendre et à corriger les erreurs.

Règles :
- Réponds dans la même langue que l'utilisateur. Ton naturel, comme à l'oral. Pas de listes à rallonge ni de "étape par étape" sauf si c'est vraiment une question de cours complexe.
- Pour les questions de finance : réponses courtes et claires (2–4 phrases max sauf si l'utilisateur demande plus). Pas de markdown, pas d'emojis.
- Pour les questions hors-sujet (salut, comment ça va, test du micro, etc.) : une seule phrase, amicale, puis recentre sur le cours si tu veux. Exemple : "Ça va bien, prêt à t'aider ! Tu as une question sur le cours ?"
- Ne donne jamais de conseil d'investissement ou d'achat/vente de titres.
- Si tu n'as pas l'info dans le contexte ou les documents, dis-le en une phrase. N'invente pas.
- Mini-quiz en fin de réponse seulement quand c'est une vraie question de cours, pas pour les bavardages ou les tests.
"""

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def thebudgecoach(request):
    # CORS preflight
    if request.method == "OPTIONS":
        return ("", 204, CORS_HEADERS)

    payload = request.get_json(silent=True) or {}
    mode = payload.get("mode", "help")  # "explain" | "example" | "error" | "help"
    user_message = payload.get("message", "")
    capsule_id = payload.get("capsuleId", "")
    block_id = payload.get("blockId", "")
    block_text = payload.get("blockText", "")
    quiz = payload.get("quiz", {}) or {}
    files = payload.get("files", []) or []  # Liste des fichiers (images/PDF)

    # --- Construire le prompt ---
    context_lines = []
    if capsule_id or block_id:
        context_lines.append(f"Contexte écran: capsule={capsule_id} block={block_id}")
    if block_text:
        context_lines.append(f"Extrait du cours affiché à l'utilisateur: {block_text}")

    if mode == "error" and quiz:
        q = quiz.get("question", "")
        choices = quiz.get("choices", [])
        selected = quiz.get("selectedIndex", None)
        correct = quiz.get("correctIndex", None)
        prompt = f"""
        L'utilisateur s'est trompé à un QCM.
        Question: {q}
        Choix: {choices}
        Réponse choisie (index): {selected}
        Bonne réponse (index): {correct}
        Tâche:
        1) Explique pourquoi la réponse choisie est fausse.
        2) Explique pourquoi la bonne réponse est correcte.
        3) Fais un rappel de cours (2-4 lignes max).
        4) Propose une mini-question de rattrapage (QCM avec 3 choix) + donne la bonne réponse à la fin sous forme: "BONNE_REPONSE: <index>"
        {chr(10).join(context_lines)}
        """
    elif mode == "example":
        prompt = f"""
        Donne un exemple concret et une analogie simple (vie quotidienne) pour aider à comprendre le passage.
        {chr(10).join(context_lines)}
        Question de l'utilisateur: {user_message}
        """
    else:  # "explain" ou "help"
        prompt = f"""
        Explique autrement (plus simple) le passage, étape par étape.
        {chr(10).join(context_lines)}
        Question de l'utilisateur: {user_message}
        """

    # Variables de réponse par défaut
    response_text = ""
    sources = []
    retrieval_queries = []
    grounded = False

    # --- Préparation du contenu pour Gemini (texte + fichiers) ---
    # Gemini attend une liste de contenus, chaque contenu étant une liste de "parts"
    # Format: [{"parts": [texte, image1, image2, ...]}]
    
    parts = []
    
    # Ajouter le texte du prompt d'abord
    parts.append(prompt)
    
    # Traiter les fichiers si présents
    if files:
        logging.info(f"📎 Traitement de {len(files)} fichier(s)...")
        for idx, file_info in enumerate(files):
            file_type = file_info.get("type", "")
            file_name = file_info.get("name", f"fichier_{idx}")
            file_data = file_info.get("data", "")
            
            if not file_data:
                logging.warning(f"Fichier {file_name} sans données")
                continue
            
            try:
                # Extraire le base64 du data URL (format: "data:image/png;base64,...")
                base64_data = None
                mime_type = None
                
                if file_data.startswith("data:"):
                    # Format data URL : data:image/png;base64,...
                    match = re.match(r"data:([^;]+);base64,(.+)", file_data)
                    if match:
                        mime_type = match.group(1)
                        base64_data = match.group(2)
                    else:
                        logging.warning(f"Format data URL invalide pour {file_name}")
                        continue
                else:
                    # Base64 pur - deviner le MIME type
                    base64_data = file_data
                    if file_type == "image":
                        # Essayer de deviner le type d'image
                        if file_name.lower().endswith(".png"):
                            mime_type = "image/png"
                        elif file_name.lower().endswith((".jpg", ".jpeg")):
                            mime_type = "image/jpeg"
                        else:
                            mime_type = "image/png"  # Par défaut
                    elif file_type == "pdf":
                        # NOTE: Gemini ne supporte peut-être pas directement les PDF
                        # Il faudra peut-être utiliser un OCR ou convertir en images
                        mime_type = "application/pdf"
                        logging.warning(f"⚠️ PDF détecté: {file_name}. Gemini peut ne pas supporter les PDF directement.")
                    else:
                        mime_type = "application/octet-stream"
                
                # Créer un Part pour Gemini avec l'image/PDF
                part = {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data  # Gemini attend le base64 directement
                    }
                }
                parts.append(part)
                logging.info(f"✅ Fichier ajouté: {file_name} ({mime_type}, {len(base64_data)} caractères base64)")
                
            except Exception as e:
                logging.error(f"❌ Erreur lors du traitement du fichier {file_name}: {e}")
                continue
        
        # Si des fichiers ont été ajoutés, améliorer le prompt
        if len(parts) > 1:  # Plus que juste le prompt
            enhanced_prompt = f"""{prompt}

IMPORTANT: L'utilisateur a joint {len(files)} fichier(s) (image(s) ou PDF). Analyse ces fichiers attentivement et réponds à la question de l'utilisateur en tenant compte du contenu visible dans ces fichiers. Pour les images, décris ce que tu vois en détail. Pour les PDF, extrais les informations importantes et réponds aux questions."""
            parts[0] = enhanced_prompt
    else:
        logging.info("Aucun fichier à traiter")
    
    # Construire le contenu final au format Gemini
    # Format attendu:
    # - Sans fichiers: "texte" (string)
    # - Avec fichiers: ["texte", {"inline_data": {...}}, ...] (liste de parts)
    if len(parts) > 1:
        # Plusieurs parts : envoyer directement la liste
        contents_to_send = parts
        logging.info(f"📤 Contenu avec {len(parts)-1} fichier(s): texte + {len(parts)-1} partie(s) multimédia")
    else:
        # Un seul part (texte) : envoyer directement la string
        contents_to_send = parts[0] if parts else prompt
        logging.info("📤 Contenu texte seul")

    # --- Appel Gemini + grounding (SECURISE) ---
    try:
        # Configurer les outils - seulement si le tool RAG est disponible
        config_params = {
            "system_instruction": SYSTEM_INSTRUCTION,
        }
        
        # Ajouter le tool RAG seulement s'il est disponible
        if tool:
            config_params["tools"] = [tool]
        
        # Envoyer le contenu à Gemini
        # contents_to_send est soit une string (texte seul) soit une liste (texte + fichiers)
        logging.info(f"📤 Envoi à Gemini: type={type(contents_to_send).__name__}")
        resp = client.models.generate_content(
            model=MODEL,
            contents=contents_to_send,
            config=GenerateContentConfig(**config_params),
        )
        
        response_text = resp.text

        # --- Extraction des métadonnées de Grounding (seulement si RAG activé) ---
        if tool and resp.candidates and resp.candidates[0].grounding_metadata:
            try:
                gm = resp.candidates[0].grounding_metadata
                
                # Récupération des requêtes faites par l'IA
                if gm.retrieval_queries:
                    retrieval_queries = gm.retrieval_queries
                # Récupération des sources (chunks)
                if gm.grounding_chunks:
                    grounded = True
                    for chunk in gm.grounding_chunks:
                        # Vertex AI Search renvoie souvent les infos dans retrieved_context
                        source_data = chunk.retrieved_context or chunk.web
                        if source_data:
                            sources.append({
                                "title": getattr(source_data, "title", "Document inconnu"),
                                "uri": getattr(source_data, "uri", "")
                            })
            except Exception as e_parsing:
                logging.warning(f"Erreur parsing metadata: {e_parsing}")
                # On ne fait pas planter l'app si le parsing des sources échoue

    except Exception as e:
        # En cas d'erreur API, on renvoie l'erreur au lieu de faire planter la fonction
        logging.error(f"Erreur Gemini: {e}")
        error_msg = str(e)
        
        # Si c'est une erreur de DataStore, on essaie sans RAG
        if "DataStore" in error_msg and "not found" in error_msg and tool:
            logging.info("Tentative sans RAG après erreur DataStore...")
            try:
                logging.info(f"📤 Tentative sans RAG: type={type(contents_to_send).__name__}")
                resp = client.models.generate_content(
                    model=MODEL,
                    contents=contents_to_send,
                    config=GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        # Pas de tools = pas de RAG
                    ),
                )
                response_text = resp.text
                logging.info("✅ Réponse reçue de Gemini (sans RAG)")
            except Exception as e2:
                logging.error(f"❌ Erreur même sans RAG: {e2}")
                response_text = f"Oups, je n'arrive pas à accéder à mon cerveau financier pour le moment. (Erreur technique: {str(e2)})"
        else:
            response_text = f"Oups, je n'arrive pas à accéder à mon cerveau financier pour le moment. (Erreur technique: {error_msg})"

    # Construction de la réponse enrichie
    body = {
        "text": response_text,
        "grounded": grounded,
        "sourcesCount": len(sources),
        "sources": sources[:5],  # On garde les 5 premières sources max pour ne pas surcharger
        "retrievalQueries": retrieval_queries[:5],
    }
    
    return (json.dumps(body, ensure_ascii=False), 200, CORS_HEADERS)

