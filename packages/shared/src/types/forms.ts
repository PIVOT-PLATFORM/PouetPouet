// Module Formulaires — formulaires autonomes type Google Forms : création,
// partage par lien public, collecte et export des réponses.

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'email'
  | 'dropdown'
  | 'radio'
  | 'checkboxes'
  | 'scale'
  | 'file'
  | 'grid'      // grille / matrice : lignes × colonnes
  | 'section'   // saut de section / page (pas un champ de saisie)

// Cible de routage conditionnel : id d'un champ section, ou fin du formulaire.
export const FORM_SUBMIT_TARGET = '_submit'

export interface FormFieldDef {
  id: string
  label: string
  description?: string
  type: FormFieldType
  required: boolean
  options?: string[]       // pour dropdown / radio / checkboxes
  allowOther?: boolean     // radio / checkboxes : ajoute une option « Autre » libre
  // validation
  min?: number             // number : valeur minimale
  max?: number             // number : valeur maximale
  maxLength?: number       // short_text / long_text : longueur max
  pattern?: string         // short_text : regex à respecter
  // échelle linéaire
  scaleMin?: number        // défaut 1
  scaleMax?: number        // défaut 5
  scaleMinLabel?: string
  scaleMaxLabel?: string
  // grille / matrice
  gridRows?: string[]
  gridCols?: string[]
  gridMultiple?: boolean   // true = cases à cocher par ligne ; false = choix unique par ligne
  // logique conditionnelle (radio / dropdown) : option → id de section cible ou FORM_SUBMIT_TARGET
  optionRouting?: Record<string, string>
}

// Valeur stockée pour un champ fichier dans data[fieldId].
export interface FormFileValue {
  key: string
  filename: string
  size: number
}

export type FormRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface FormSummary {
  id: string
  ownerId: string
  title: string
  description: string | null
  isPublished: boolean
  acceptingResponses: boolean
  limitOneResponse: boolean
  notifyOnResponse: boolean
  confirmationMessage: string | null
  redirectUrl: string | null
  closesAt: string | null
  maxResponses: number | null
  publicToken: string
  fieldCount: number
  responseCount: number
  role: FormRole
  createdAt: string
  updatedAt: string
}

export interface FormDetail extends Omit<FormSummary, 'fieldCount'> {
  fields: FormFieldDef[]
}

// Vue publique servie à la page de remplissage (sans infos propriétaire).
export interface PublicForm {
  id: string
  title: string
  description: string | null
  fields: FormFieldDef[]
  acceptingResponses: boolean
  limitOneResponse: boolean
  confirmationMessage: string | null
  redirectUrl: string | null
  // raison de fermeture éventuelle, pour message dédié côté public
  closedReason?: 'manual' | 'date' | 'max' | null
}

export interface FormResponseEntry {
  id: string
  formId: string
  respondentId: string | null
  data: Record<string, unknown>
  createdAt: string
}
