export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'
export type SkipIfDef = { field: string; operator: ConditionOperator; value: string }
export type FlowEdgeDef = { id: string; source: string; target: string; condition?: SkipIfDef; label?: string }

export type GroupMember = { id: string; label?: string }

export type ModuleStepDef = {
  type?: string
  assignedTo?: string
  slaDays?: number
  skipIf?: SkipIfDef
  moduleAction?: 'create_board' | 'create_meeting' | 'create_daily' | 'create_scrum'
  moduleParams?: { title?: string }
  httpMethod?: string
  httpUrl?: string
  httpHeaders?: Record<string, string>
  httpBody?: string
  httpOutputKey?: string
  approvers?: string[]
  requireAll?: boolean
  aiPrompt?: string
  aiSystemPrompt?: string
  aiModel?: string
  aiOutputKey?: string
  assignmentMode?: 'user' | 'group' | 'chain' | 'nominated'
  groupLabel?: string
  groupMembers?: GroupMember[]
  nominatedFromGroup?: GroupMember[]
  validationNotify?: {
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
}

export function evalCondition(cond: SkipIfDef, data: Record<string, unknown>): boolean {
  const raw = data[cond.field]
  const val = String(raw ?? '')
  // Une valeur vide/absente ne doit PAS être coercée en 0 (Number('') === 0),
  // sinon un champ non renseigné satisfait à tort les comparaisons numériques.
  const num = raw === '' || raw == null ? NaN : Number(raw)
  const threshold = Number(cond.value)
  switch (cond.operator) {
    case 'eq': return val === cond.value
    case 'neq': return val !== cond.value
    case 'contains': return val.includes(cond.value)
    case 'gt': return !isNaN(num) && !isNaN(threshold) && num > threshold
    case 'lt': return !isNaN(num) && !isNaN(threshold) && num < threshold
    case 'gte': return !isNaN(num) && !isNaN(threshold) && num >= threshold
    case 'lte': return !isNaN(num) && !isNaN(threshold) && num <= threshold
  }
}

export function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(data[k] ?? ''))
}

// Bloque les schémas non-HTTP et les plages IP privées/lien-local (SSRF).
function assertSafeUrl(raw: string): void {
  const u = new URL(raw)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Schéma non autorisé')
  const h = u.hostname
  if (/^(localhost|127\.|0\.0\.0\.0|::1)/.test(h)) throw new Error('Hôte non autorisé')
  if (/^169\.254\./.test(h)) throw new Error('Hôte non autorisé (lien-local)')
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) throw new Error('Hôte non autorisé (privé)')
}

export async function executeHttpStep(
  step: ModuleStepDef,
  instanceData: Record<string, unknown>,
): Promise<{ outputKey: string | null; output: unknown }> {
  const url = interpolate(step.httpUrl ?? '', instanceData)
  if (!url) return { outputKey: null, output: null }
  assertSafeUrl(url)
  const method = step.httpMethod ?? 'GET'
  const body = step.httpBody ? interpolate(step.httpBody, instanceData) : undefined
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(step.httpHeaders ?? {}) }
  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body } : {}),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  let output: unknown = null
  try { output = await res.json() } catch { output = await res.text().catch(() => null) }
  return { outputKey: step.httpOutputKey ?? null, output }
}

export async function executeValidationNotifications(
  step: ModuleStepDef,
  context: { instanceTitle: string; stepTitle: string; assignedTo: string | null; instanceId: string },
): Promise<void> {
  const n = step.validationNotify
  if (!n) return

  const subject = interpolate(
    context.stepTitle || 'Validation requise',
    { title: context.instanceTitle, assignedTo: context.assignedTo ?? '' },
  )
  const body = `Étape "${subject}" dans le parcours "${context.instanceTitle}" nécessite votre action.`

  const errors: string[] = []

  if (n.teamsWebhookUrl) {
    await fetch(n.teamsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
    }).catch((e) => errors.push(`Teams: ${e.message}`))
  }

  if (n.jiraHost && n.jiraProject) {
    const auth = process.env.JIRA_AUTH
    if (auth) {
      const summary = n.jiraSummary
        ? interpolate(n.jiraSummary, { title: context.instanceTitle, step: context.stepTitle })
        : subject
      await fetch(`${n.jiraHost.replace(/\/$/, '')}/rest/api/3/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          fields: {
            project: { key: n.jiraProject },
            summary,
            issuetype: { name: n.jiraIssueType ?? 'Task' },
          },
        }),
      }).catch((e) => errors.push(`Jira: ${e.message}`))
    }
  }

  if (n.openprojectHost && n.openprojectProjectId) {
    const token = process.env.OPENPROJECT_TOKEN
    if (token) {
      const subjectText = n.openprojectSubject
        ? interpolate(n.openprojectSubject, { title: context.instanceTitle, step: context.stepTitle })
        : subject
      await fetch(`${n.openprojectHost.replace(/\/$/, '')}/api/v3/projects/${n.openprojectProjectId}/work_packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: subjectText, _links: { type: { href: '/api/v3/types/1' } } }),
      }).catch((e) => errors.push(`OpenProject: ${e.message}`))
    }
  }

  if (errors.length) console.warn('[validation-notify] errors:', errors)
}

export async function executeAiStep(
  step: ModuleStepDef,
  instanceData: Record<string, unknown>,
  apiKey?: string,
): Promise<{ outputKey: string | null; output: unknown }> {
  if (!apiKey) return { outputKey: null, output: null }
  const prompt = interpolate(step.aiPrompt ?? '', instanceData)
  if (!prompt) return { outputKey: null, output: null }
  const model = step.aiModel ?? 'claude-haiku-4-5-20251001'
  const systemPrompt = step.aiSystemPrompt ? interpolate(step.aiSystemPrompt, instanceData) : undefined
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const json = (await res.json()) as { content?: { type: string; text: string }[] }
  const output = json.content?.[0]?.text ?? null
  return { outputKey: step.aiOutputKey ?? null, output }
}

export function resolveNextStep(
  currentIdx: number,
  steps: ModuleStepDef[],
  flowEdges: FlowEdgeDef[],
  statuses: Map<number, string>,
  instanceData: Record<string, unknown>,
): number {
  const edgesFromCurrent = flowEdges.filter((e) => e.source === String(currentIdx))
  if (edgesFromCurrent.length === 0) {
    for (let i = currentIdx + 1; i < steps.length; i++) {
      const st = statuses.get(i)
      if (st !== 'COMPLETED' && st !== 'SKIPPED') return i
    }
    return steps.length
  }
  const condEdges = edgesFromCurrent.filter((e) => e.condition)
  const uncondEdges = edgesFromCurrent.filter((e) => !e.condition)
  // Une cible non numérique (ex : nœud « end » du canvas) = fin de workflow.
  const targetIdx = (t: string): number => {
    const n = parseInt(t, 10)
    return Number.isNaN(n) ? steps.length : n
  }
  for (const edge of condEdges) {
    if (edge.condition && evalCondition(edge.condition, instanceData)) return targetIdx(edge.target)
  }
  if (uncondEdges.length > 0) return targetIdx(uncondEdges[0].target)
  return steps.length
}
