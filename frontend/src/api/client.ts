import axios from 'axios'

/**
 * Axios instance pre-configured for the NIDS API.
 * Uses relative /api base path to leverage Vite dev server proxying,
 * eliminating CORS, preflight, and cross-origin loopback connection blocks.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
})

export default apiClient
