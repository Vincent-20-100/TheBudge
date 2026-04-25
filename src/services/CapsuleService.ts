// Service to load capsule metadata
export interface CapsuleMetadata {
  id: number;
  title: string;
  description?: string;
}

// For now, we'll use static metadata. In production, this would be loaded from the markdown files
export const capsuleMetadata: CapsuleMetadata[] = [
  {
    id: 1,
    title: 'La Bourse démystifiée',
    description: 'Comprendre en 5 minutes'
  },
  {
    id: 2,
    title: 'Qui décide vraiment du prix',
    description: 'Comprendre la valorisation'
  },
  {
    id: 3,
    title: 'Les intérêts composés',
    description: 'La 8e merveille du monde'
  },
  {
    id: 4,
    title: '200 ans de croissance',
    description: 'La logique derrière la Bourse'
  },
  {
    id: 5,
    title: 'ETF et investissement progressif',
    description: 'Investir sans stress'
  },
  {
    id: 6,
    title: 'Sur quel monde paries-tu ?',
    description: 'Construis ta stratégie'
  },
  {
    id: 7,
    title: 'PEA, CTO, Assurance-vie',
    description: 'Choisis la bonne enveloppe'
  },
  {
    id: 8,
    title: 'Gestion des risques',
    description: 'Prépare-toi mentalement'
  },
  {
    id: 9,
    title: 'Passe à l\'action',
    description: 'Cette semaine (même avec 10€)'
  },
  {
    id: 10,
    title: 'Lire un graphique',
    description: 'Tendance, support et résistance'
  },
  {
    id: 11,
    title: 'Comprendre les cycles',
    description: 'Expansion, ralentissement, reprise'
  },
  {
    id: 12,
    title: 'Psychologie de marché',
    description: 'Éviter les décisions impulsives'
  },
  {
    id: 13,
    title: 'Construire son allocation',
    description: 'Répartir selon son profil'
  },
  {
    id: 14,
    title: 'Rééquilibrer son portefeuille',
    description: 'Garder le cap dans le temps'
  },
  {
    id: 15,
    title: 'Plan des 12 prochains mois',
    description: 'Routine simple et durable'
  },
];

export const loadCapsuleMetadata = async (id: number): Promise<CapsuleMetadata | null> => {
  return capsuleMetadata.find(c => c.id === id) || null;
};

export const getAllCapsules = (): CapsuleMetadata[] => {
  return capsuleMetadata;
};
