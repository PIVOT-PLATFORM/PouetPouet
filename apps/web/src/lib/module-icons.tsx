import {
  LayoutDashboard,
  Target,
  Sun,
  Shuffle,
  BarChart2,
  Calendar,
  Users,
  Map,
  ClipboardList,
  FlaskConical,
  FileText,
  Package,
  KeyRound,
  Compass,
  PenLine,
  Cloud,
  Lightbulb,
  CircleCheckBig,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// Mapping moduleId → icône Lucide (remplace les emoji décoratifs — #124).
export const MODULE_ICONS: Record<string, LucideIcon> = {
  pouetpouet: LayoutDashboard,
  scrum:       Target,
  daily:       Sun,
  wheel:       Shuffle,
  capacity:    BarChart2,
  meetops:     Calendar,
  teams:       Users,
  testbooks:   FlaskConical,
  quiz:        Zap,
  roadmap:     Map,
}

// Icônes pour les activités de board (activity-launcher et boards).
export const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  POLL:       BarChart2,
  WORDCLOUD:  Cloud,
  BRAINSTORM: Lightbulb,
  QUIZ:       CircleCheckBig,
}

// Icônes pour les modules à venir (Hub upcoming section).
export const UPCOMING_ICONS: Record<string, LucideIcon> = {
  Roadmap:                            Map,
  'Mes PIP':                          ClipboardList,
  'Mes PDF':                          FileText,
  'Mes poses (PV de pose & label)':   Package,
  "Demande d'accès serveur":          KeyRound,
  'Mes FDR':                          Compass,
  SignDoc:                            PenLine,
}

// Icônes pour la page d'aide.
export const AIDE_ICONS: Record<string, LucideIcon> = {
  boards:    LayoutDashboard,
  sessions:  Users,
  scrum:     Target,
  daily:     Timer,
  wheel:     Shuffle,
  account:   Users,
}
