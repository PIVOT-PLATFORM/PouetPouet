export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMProvider {
  chat(messages: ChatMessage[], onToken: (token: string) => void, signal?: AbortSignal): Promise<void>
}
