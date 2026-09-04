import axios from 'axios';

// Canonical base URL: strip trailing /api/v1 and trailing slashes so base is clean
const RAW_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API = RAW_API.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
export const API_URL = `${API}/api/v1`;

const api = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ── Request Interceptor ───────────────────────────────────────────────────────
// 1. Ensures EVERY relative request URL begins with /api/v1
// 2. Injects auth token if present
api.interceptors.request.use(
  (config) => {
    if (config.url && !config.url.startsWith('http')) {
      if (!config.url.startsWith('/api/v1') && !config.url.startsWith('api/v1')) {
        const cleanPath = config.url.startsWith('/') ? config.url : `/${config.url}`;
        config.url = `/api/v1${cleanPath}`;
      }
    }
    if (typeof window !== 'undefined') {
      const token =
        localStorage.getItem('floodsense_token') ||
        sessionStorage.getItem('floodsense_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor ──────────────────────────────────────────────────────
// Unwraps {"success": true, "data": ...} and retries on 5xx / network errors
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    const isRetryable = !error.response || error.response.status >= 500;
    const isGet = config.method?.toLowerCase() === 'get';
    const retryCount = config.__retryCount ?? 0;

    if (isGet && isRetryable && retryCount < 2) {
      config.__retryCount = retryCount + 1;
      const delay = 500 * Math.pow(2, retryCount);
      await new Promise((res) => setTimeout(res, delay));
      return api(config);
    }

    return Promise.reject(error);
  },
);

export { api };
export default api;
