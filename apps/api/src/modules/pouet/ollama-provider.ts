import type { LLMProvider, ChatMessage } from './llm-provider.js'

// OllamaProvider talks to Ollama's OpenAI-compatible endpoint.
// Swap to Claude/Gemini by implementing LLMProvider with a different class.
export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string
  private readonly model: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    this.model = process.env.POUET_MODEL ?? 'llama3.2:3b'
  }

  async chat(messages: ChatMessage[], onToken: (token: string) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}: ${text}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') return
          try {
            const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
            const token = json.choices?.[0]?.delta?.content
            if (token) onToken(token)
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
