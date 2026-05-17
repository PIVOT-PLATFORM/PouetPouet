export type ActivityType = 'QUIZ' | 'POLL' | 'WORDCLOUD' | 'BRAINSTORM' | 'QA'
export type ActivityStatus = 'PENDING' | 'ACTIVE' | 'CLOSED'

export interface Activity {
  id: string
  sessionId: string
  type: ActivityType
  title: string
  config: Record<string, unknown>
  status: ActivityStatus
  createdAt: Date
}

export interface ActivityResponse {
  id: string
  activityId: string
  participantId: string
  value: unknown
  createdAt: Date
}

export interface PollConfig {
  question: string
  options: string[]
  multiple: boolean
}

export interface QuizConfig {
  question: string
  options: string[]
  correctAnswer: number
  timeLimit?: number
}

export interface WordcloudConfig {
  question: string
  maxWords?: number
}

export interface BrainstormConfig {
  topic: string
  anonymous: boolean
}
