import axios from 'axios';

/**
 * Normalizes API Base URL to prevent:
 * - Trailing slashes
 * - Accidental `/api/v1/api/v1` duplication
 * - Missing `/api/v1` prefix
 */
export function normalizeApiBaseUrl(rawUrl) {
  let url = (rawUrl || '').trim();
  if (!url) {
    const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '127.0.0.1';
    url = `http://${hostname}:8000/api/v1`;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // Normalize duplicate or missing /api/v1
  if (url.endsWith('/api/v1/api/v1')) {
    url = url.replace(/\/api\/v1\/api\/v1$/, '/api/v1');
  } else if (url.endsWith('/api/v1')) {
    // Already correct
  } else if (url.endsWith('/api')) {
    url = `${url}/v1`;
  } else {
    url = `${url}/api/v1`;
  }

  return url;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
);

export const API_BASE = API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('ner88_token') ||
      localStorage.getItem('link_x8_token') ||
      localStorage.getItem('ner_logiai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log meaningful non-cancellation errors
    if (!axios.isCancel(error)) {
      console.warn('[API Error]', error.config?.url, error.response?.status || error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Health check helper for backend status detection
 */
export async function checkBackendHealth() {
  try {
    const res = await api.get('/health', { timeout: 4000 });
    return {
      connected: res.status === 200,
      status: res.data?.status || 'ok',
      data: res.data,
    };
  } catch (err) {
    return {
      connected: false,
      status: 'disconnected',
      error: err.message || 'Backend unreachable',
    };
  }
}

/**
 * Health check helper for Open-Meteo weather service
 */
export async function checkWeatherHealth() {
  try {
    const res = await api.get('/health/weather', { timeout: 6000 });
    return {
      ok: res.status === 200,
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.response?.data?.detail?.error || err.message || 'Weather service unreachable',
    };
  }
}

export default api;
