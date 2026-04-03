// frontend/src/services/api.ts
import axios from 'axios'
import { auth } from './firebase'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// Ajoute le token Firebase à chaque requête
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Log propre des erreurs
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.detail ?? error.message
      console.error(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${message}`
      )
    }
    return Promise.reject(error)
  }
)
