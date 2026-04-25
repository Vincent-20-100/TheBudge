// Service to load motivational and congratulatory phrases
import arbreASous from '../assets/bears/arbre a sous.png';
import assisSurArgent from "../assets/bears/assis sur l'argent.png";
import bearWords from '../assets/bears/bear_words_logo-1-Photoroom.png';
import invitingBear from '../assets/bears/inviting_bear-1-Photoroom.png';
import jumpingBear from '../assets/bears/jumping_bear-1-Photoroom.png';
import lovingBear from '../assets/bears/loving_bear-1-Photoroom.png';
import oursAvecLivres from '../assets/bears/ours avec des livres.png';
import shiaBear from '../assets/bears/shia_bear-1-Photoroom.png';
import singingBear from '../assets/bears/singing_bear-1-Photoroom.png';

const motivationPhrases = [
  'Ne laisse pas dormir ton argent.',
  'Domptez votre épargne.',
  'Si vous ne savez pas quoi faire de votre argent, quelqu\'un le saura pour vous.',
  'Le secret le mieux gardé de votre compte en banque.',
  'Votre argent s\'ennuie ? On a un plan.',
  'Arrêtez de deviner, commencez à budgéter.',
  'L\'argent ne fait pas le bonheur, mais savoir l\'utiliser, si.',
  'Mettez un ours dans votre moteur financier.',
  'Parce que votre banquier n\'est pas votre meilleur ami.',
  'Votre portefeuille mérite mieux qu\'un tiroir.',
  'L\'investissement, c\'est comme le sport : plus tôt on commence, mieux c\'est.',
  'Transformez vos économies en opportunités.',
  'La finance n\'est pas un mystère, c\'est une compétence.',
  'Chaque euro compte, surtout quand il travaille pour vous.',
  'Ne soyez pas spectateur de votre propre argent, soyez acteur.'
];

const felicitationPhrases = [
  'Bravo ! Vous êtes sur la bonne voie pour dompter votre épargne.',
  'Excellent travail ! Votre argent va être fier de vous.',
  'Félicitations ! Vous venez de faire un pas de plus vers l\'indépendance financière.',
  'Génial ! Vous êtes maintenant plus malin que votre compte en banque.',
  'Chapeau ! Vous avez transformé la confusion en compréhension.',
  'Superbe ! Votre portefeuille vous remercie déjà.',
  'Impressionnant ! Vous êtes en train de devenir un pro de la finance.',
  'Fantastique ! Chaque leçon vous rapproche de vos objectifs financiers.',
  'Magnifique ! Vous avez compris que l\'argent peut travailler pour vous.',
  'Remarquable ! Vous êtes sur la voie de la liberté financière.',
  'Extraordinaire ! Votre avenir financier vous sourit.',
  'Incroyable ! Vous avez fait un pas de géant vers la maîtrise de vos finances.',
  'Formidable ! Vous êtes en train de construire votre avenir financier.',
  'Brillant ! Chaque leçon vous rend plus riche en connaissances.',
  'Parfait ! Vous êtes maintenant armé pour prendre de meilleures décisions financières.'
];

const bearImages = [
  arbreASous,
  assisSurArgent,
  bearWords,
  invitingBear,
  jumpingBear,
  lovingBear,
  oursAvecLivres,
  shiaBear,
  singingBear,
];

export const getRandomMotivationPhrase = (): string => {
  return motivationPhrases[Math.floor(Math.random() * motivationPhrases.length)];
};

export const getRandomFelicitationPhrase = (): string => {
  return felicitationPhrases[Math.floor(Math.random() * felicitationPhrases.length)];
};

export const getRandomBearImage = (): string => {
  return bearImages[Math.floor(Math.random() * bearImages.length)];
};

// Quiz pause – transition avant la partie « Vérification des Connaissances » (source: public/quiz_pause.md)
const quizPausePhrasesFallback = [
  'Prêt à faire chauffer tes neurones ? C\'est l\'heure du quiz !',
  'Voyons voir ce que tu as retenu... Place aux questions !',
  'La théorie c\'est bien, la pratique c\'est mieux. À toi de jouer !',
  'Finie la lecture, place au game. Let\'s go !',
  'Petit check-up avant la suite : tu gères ou tu gères ?',
  'C\'est parti pour 2 minutes de questions. Pas de stress, c\'est juste pour voir !',
  'Allez, on vérifie que tout est bien rentré. Go !',
  'Moment vérité : tu as suivi ou tu as scroll ? (On rigole... ou pas.)',
  'Trois questions, zero prise de tête. Tu peux le faire !',
  'La partie fun commence maintenant. Yes, le quiz c\'est fun.',
  'Récap express : on voit si t\'as tout capté. C\'est parti !',
  'Théorie : done. Maintenant on s\'amuse un peu avec des questions.',
  'Tu as bien lu ? (Enfin on va voir.) C\'est l\'heure du quiz !',
  'Petit test rapide pour voir si t\'es au niveau. Spoiler : t\'es au niveau.',
  'Pause lecture terminée. Place au quiz, et ça va le faire !'
];

let quizPausePhrasesCache: string[] | null = null;

/** Parse quiz_pause.md content into array of phrases (numbered lines "1. ...") */
export function parseQuizPausePhrases(mdContent: string): string[] {
  const lines = mdContent.split(/\r?\n/);
  const phrases: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const match = t.match(/^\d+\.\s*(.+)$/);
    if (match) phrases.push(match[1].trim());
  }
  return phrases.length > 0 ? phrases : quizPausePhrasesFallback;
}

/** Load phrases from public/quiz_pause.md; returns fallback if fetch fails */
export async function loadQuizPausePhrases(): Promise<string[]> {
  if (quizPausePhrasesCache) return quizPausePhrasesCache;
  try {
    const res = await fetch('/quiz_pause.md');
    if (!res.ok) return quizPausePhrasesFallback;
    const text = await res.text();
    quizPausePhrasesCache = parseQuizPausePhrases(text);
    return quizPausePhrasesCache.length > 0 ? quizPausePhrasesCache : quizPausePhrasesFallback;
  } catch {
    return quizPausePhrasesFallback;
  }
}

/** Random quiz pause phrase (uses fallback until loadQuizPausePhrases has been called) */
export function getRandomQuizPausePhrase(phrases?: string[]): string {
  const list = phrases && phrases.length > 0 ? phrases : (quizPausePhrasesCache || quizPausePhrasesFallback);
  return list[Math.floor(Math.random() * list.length)];
}
