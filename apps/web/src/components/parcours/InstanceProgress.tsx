'use client'

import { CheckCircle2, Circle, XCircle, SkipForward, AlertCircle, Clock } from 'lucide-react'
import type { StepDef, ParcourStepInstanceDetail, StepStatus } from '@pouetpouet/shared'

interface Props {
  steps: StepDef[]
  stepInstances: ParcourStepInstanceDetail[]
  currentStep: number
  selectedStep?: number
  onSelect?: (idx: number) => void
}

const STEP_TYPE_LABEL: Record<string, string> = {
  info:     'Info',
  form:     'Formulaire',
  document: 'Document',
  approval: 'Validation',
  email:    'Email',
  module:   'Module',
}

function StepIcon({ status, isOverdue }: { status: StepStatus; isOverdue: boolean }) {
  if (status === 'COMPLETED') return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
  if (status === 'REJECTED')  return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
  if (status === 'SKIPPED')   return <SkipForward className="w-4 h-4 text-gray-400 flex-shrink-0" />
  if (isOverdue)              return <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
  return <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
}

export function InstanceProgress({ steps, stepInstances, currentStep, selectedStep, onSelect }: Props) {
  const completed = stepInstances.filter((s) => s.status === 'COMPLETED').length
  const pct = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0
  const now = new Date()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{completed}/{steps.length} étapes</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-col gap-1 mt-1">
        {steps.map((step, idx) => {
          const si = stepInstances.find((s) => s.stepIndex === idx)
          const status: StepStatus = si?.status ?? 'PENDING'
          const isCurrent = idx === currentStep && status === 'PENDING'
          const isOverdue = status === 'PENDING' && !!si?.dueAt && new Date(si.dueAt) < now
          const isSoonDue = !isOverdue && status === 'PENDING' && !!si?.dueAt &&
            new Date(si.dueAt).getTime() - now.getTime() < 24 * 60 * 60 * 1000

          const isSelected = selectedStep === idx
          return (
            <button
              key={idx}
              onClick={() => onSelect?.(idx)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                isSelected
                  ? 'bg-cyan-50 dark:bg-cyan-900/20 ring-1 ring-cyan-200 dark:ring-cyan-800'
                  : isCurrent
                  ? 'hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10'
                  : isOverdue
                  ? 'hover:bg-orange-50 dark:hover:bg-orange-900/10'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <StepIcon status={status} isOverdue={isOverdue} />
              <div className="flex-1 min-w-0">
                <span className={`text-sm truncate block ${
                  isSelected ? 'font-medium text-cyan-700 dark:text-cyan-300' :
                  isCurrent ? 'font-medium text-cyan-600 dark:text-cyan-400' :
                  isOverdue ? 'font-medium text-orange-700 dark:text-orange-400' :
                  status === 'COMPLETED' ? 'text-gray-400 dark:text-gray-500' :
                  'text-gray-700 dark:text-gray-300'
                }`}>
                  {step.title}
                </span>
                {si?.dueAt && status === 'PENDING' && (
                  <span className={`text-xs flex items-center gap-1 mt-0.5 ${
                    isOverdue ? 'text-orange-500' : isSoonDue ? 'text-yellow-500' : 'text-gray-400'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {isOverdue ? 'En retard · ' : ''}
                    {new Date(si.dueAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{STEP_TYPE_LABEL[step.type] ?? step.type}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
