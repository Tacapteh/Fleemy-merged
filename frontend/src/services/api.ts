// frontend/src/services/api.ts
import axios from 'axios'
import { auth } from './firebase'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const RETRY_DELAYS = [1000, 2000, 4000] // ms, 3 attempts max

function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return true // network-level error
  const status = error.response?.status
  if (status === undefined) return true // no response = network error
  if (status === 429) return true // rate-limited
  return status >= 500 // server errors only
}

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

// Retry avec backoff exponentiel + log propre des erreurs
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error)
    }

    const config = error.config as typeof error.config & { _retryCount?: number }
    config._retryCount = config._retryCount ?? 0

    if (isRetryable(error) && config._retryCount < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[config._retryCount]
      config._retryCount += 1
      await new Promise((resolve) => setTimeout(resolve, delay))
      return apiClient(config)
    }

    const message = error.response?.data?.detail ?? error.message
    console.error(
      `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${message}`
    )
    return Promise.reject(error)
  }
)
