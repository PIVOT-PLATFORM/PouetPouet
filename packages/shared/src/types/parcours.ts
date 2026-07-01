export type ParcourDocClass = 'C0' | 'C1' | 'C2' | 'C3'

export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'

export type FlowCondition = { field: string; operator: ConditionOperator; value: string }

export type FlowEdge = {
  id: string
  source: string // stepIndex as string
  target: string // stepIndex as string
  condition?: FlowCondition
  label?: string
}

export type TriggerType = 'manual' | 'form_response' | 'webhook' | 'schedule' | 'poll'
export type ParcourStatus = 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
export type StepStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'SKIPPED'
export type ModuleRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type FormField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'
  required: boolean
  options?: string[]
}

export type ValidationAssignmentMode = 'user' | 'group' | 'chain' | 'nominated'

export type GroupMember = { id: string; label?: string }

export type ValidationNotifyConfig = {
  email?: boolean
  teamsWebhookUrl?: string
  jiraHost?: string
  jiraProject?: string
  jiraIssueType?: string
  jiraSummary?: string
  openprojectHost?: string
  openprojectProjectId?: string
  openprojectSubject?: string
}

export type StepDef = {
  type: 'info' | 'form' | 'document' | 'approval' | 'email' | 'notification' | 'module' | 'http' | 'approval-chain' | 'ai-prompt' | 'validation'
  title: string
  assignedTo?: string
  assignedLabel?: string
  slaDays?: number
  reminderDays?: number
  skipIf?: FlowCondition
  // info
  body?: string
  // form — inline fields OR linked Forms module form (formId + formPublicToken)
  fields?: FormField[]
  formId?: string
  formPublicToken?: string
  // document / mixed
  maxClass?: ParcourDocClass
  instructions?: string
  requireDocument?: boolean
  // email (legacy) / notification
  to?: string
  subject?: string
  notifyChannels?: { inApp?: boolean; email?: boolean; teamsWebhookUrl?: string }
  // module
  moduleId?: string
  moduleHref?: string
  moduleAction?: 'create_board' | 'create_meeting' | 'create_daily' | 'create_scrum'
  moduleParams?: { title?: string }
  // http — appel HTTP sortant automatique
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  httpUrl?: string // supporte {{variable}} depuis instance.data
  httpHeaders?: Record<string, string>
  httpBody?: string // JSON template avec {{variable}}
  httpOutputKey?: string // clé dans instance.data où stocker la réponse
  // approval-chain — séquence d'approbateurs auto-avancée (legacy, préférer validation+chain)
  approvers?: string[] // userId[] dans l'ordre
  requireAll?: boolean // true = tous doivent approuver (défaut), false = premier suffit
  // ai-prompt — appel IA auto (beta)
  aiPrompt?: string        // prompt utilisateur avec {{variable}}
  aiSystemPrompt?: string  // system prompt optionnel
  aiModel?: string         // ex: claude-haiku-4-5-20251001
  aiOutputKey?: string     // clé dans instance.data
  // validation — type unifié (remplace approval + approval-chain)
  assignmentMode?: ValidationAssignmentMode
  groupLabel?: string        // nom du groupe (mode group/nominated)
  groupMembers?: GroupMember[] // membres du groupe { id: userId, label?: nom }
  nominatedFromGroup?: GroupMember[] // groupe dans lequel le validateur précédent nomme (mode nominated)
  validationNotify?: ValidationNotifyConfig
}

export interface ParcourTemplateSummary {
  id: string
  ownerId: string
  name: string
  description: string | null
  category: string | null
  tags: string[]
  isPublic: boolean
  starCount: number
  stepCount: number
  role: ModuleRole
  createdAt: string
  updatedAt: string
}

export interface ParcourTemplateDetail extends ParcourTemplateSummary {
  steps: StepDef[]
  flowEdges: FlowEdge[]
  triggerType: TriggerType
  triggerConfig: {
    formId?: string
    cronExpression?: string
    cronTitle?: string
    webhookTitle?: string
  }
  webhookToken?: string | null
  defaultObservers: string[]
}

export interface ParcourInstanceSummary {
  id: string
  templateId: string
  ownerId: string
  title: string
  refNumber: string | null
  status: ParcourStatus
  priority: string
  currentStep: number
  stepCount: number
  dueAt: string | null
  remindByEmail: boolean
  role: ModuleRole
  createdAt: string
  updatedAt: string
}

export interface ParcourStepInstanceDetail {
  id: string
  instanceId: string
  stepIndex: number
  status: StepStatus
  assignedTo: string | null
  completedBy: string | null
  completedAt: string | null
  dueAt: string | null
  data: Record<string, unknown> | null
}

export interface ParcourDocumentSummary {
  id: string
  instanceId: string
  stepIndex: number | null
  filename: string
  mimeType: string
  sizeBytes: number
  classification: ParcourDocClass
  uploadedBy: string
  createdAt: string
}

export interface ParcourHistoryEntry {
  id: string
  instanceId: string
  stepIndex: number | null
  userId: string | null
  action: string
  comment: string | null
  createdAt: string
}

export interface ParcourInstanceDetail {
  id: string
  templateId: string
  ownerId: string
  title: string
  refNumber: string | null
  status: ParcourStatus
  priority: string
  currentStep: number
  dueAt: string | null
  remindByEmail: boolean
  data: Record<string, unknown>
  role: ModuleRole
  steps: StepDef[]
  stepInstances: ParcourStepInstanceDetail[]
  documents: ParcourDocumentSummary[]
  history: ParcourHistoryEntry[]
  createdAt: string
  updatedAt: string
}
