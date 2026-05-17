export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
}

export interface AuthResponse {
  user: User
  token: string
}
