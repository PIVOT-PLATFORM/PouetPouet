// Cartographie des domaines PIVOT — source unique pour le Hub (outils actuels)
// et l'Explorateur (outils actuels + à venir). Un domaine peut n'avoir que des
// outils futurs (Architecture, RH, Plateforme) : il apparaît alors dans
// l'Explorateur pour capter l'intérêt.

export interface DomainDef {
  id: string
  label: string
  color: string
  description: string
  /** ids de modules actifs (doivent exister dans PIVOT_MODULES) */
  moduleIds: string[]
  /** outils annoncés, pas encore livrés (nom affiché) */
  upcoming: string[]
}

export const DOMAINS: DomainDef[] = [
  {
    id: 'collaboration',
    label: 'Collaboration',
    color: '#7c5cff',
    description: 'Travailler ensemble en temps réel : tableaux, ateliers, formulaires.',
    moduleIds: ['pouetpouet', 'meetops', 'quiz', 'parcours', 'forms'],
    upcoming: ['Espace documentaire', 'Messagerie d\'équipe'],
  },
  {
    id: 'agile',
    label: 'Agile',
    color: '#f59e0b',
    description: 'Rituels et cérémonies d\'équipe : estimation, daily, capacité.',
    moduleIds: ['scrum', 'daily', 'wheel', 'capacity'],
    upcoming: ['Rétrospectives guidées', 'Sprint board'],
  },
  {
    id: 'pilotage',
    label: 'Pilotage',
    color: '#4ee1ff',
    description: 'Piloter projets et portefeuille : roadmap, commande publique, risques.',
    moduleIds: ['roadmap', 'procurement'],
    upcoming: ['OKR & Objectifs', 'PPM / Portefeuille projets', 'Tableaux de bord', 'Gestion des risques'],
  },
  {
    id: 'outillage',
    label: 'Outillage',
    color: '#64748b',
    description: 'Boîte à outils transverse : documents, cahiers de test, signature.',
    moduleIds: ['pdf', 'testbooks', 'signdoc'],
    upcoming: ['Générateur de modèles', 'Coffre-fort de fichiers'],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    color: '#22c55e',
    description: 'Cartographier et documenter le SI et ses décisions.',
    moduleIds: [],
    upcoming: ['Cartographie SI', 'Plan de reprise (PRA)', 'ADR — Décisions d\'architecture'],
  },
  {
    id: 'rh',
    label: 'RH & Compétences',
    color: '#ec4899',
    description: 'Talents, expertises et parcours des équipes.',
    moduleIds: [],
    upcoming: ['Compétences & Expertise', 'Formation', 'Organigramme', 'Mes PIP'],
  },
  {
    id: 'plateforme',
    label: 'Plateforme',
    color: '#a78bff',
    description: 'Les briques transverses qui relient toute la suite Pivot.',
    moduleIds: [],
    upcoming: ['Recherche fédérée', 'Assistant IA', 'Intégration SI'],
  },
]

// Raccourcis « Mon espace » — vues user-centric (pas admin)
export const MON_ESPACE: { label: string; desc: string; href: string; moduleId: string }[] = [
  { label: 'Mes parcours', desc: 'Instances actives et historique', href: '/parcours', moduleId: 'parcours' },
  { label: 'Mes formulaires', desc: 'Formulaires partagés avec vous', href: '/forms', moduleId: 'forms' },
]
