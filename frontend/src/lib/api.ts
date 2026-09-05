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
// 1. Ensures EVERY request URL (relative or absolute) targets /api/v1
// 2. Prevents double /api/v1/api/v1 concatenation
// 3. Injects auth token if present
api.interceptors.request.use(
  (config) => {
    if (config.url) {
      // Collapse duplicate /api/v1/api/v1
      config.url = config.url.replace(/\/api\/v1\/api\/v1/g, '/api/v1');

      // If full URL starts with API but missing /api/v1, insert /api/v1
      if (config.url.startsWith(API) && !config.url.includes('/api/v1')) {
        config.url = config.url.replace(API, API_URL);
      }

      // If relative URL, ensure it starts with /api/v1
      if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
        if (!config.url.startsWith('/api/v1') && !config.url.startsWith('api/v1')) {
          const cleanPath = config.url.startsWith('/') ? config.url : `/${config.url}`;
          config.url = `/api/v1${cleanPath}`;
        }
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

// ── Canonical API routes & centralized call helpers ───────────────────────────
export const API_ROUTES = {
  HEALTH: '/api/v1/health',
  DASHBOARD_LIVE: '/api/v1/dashboard/live',
  SPATIAL_DISTRICT_BOUNDS: '/api/v1/spatial/district-bounds',
  PREDICT_INFERENCE_CYCLE: '/api/v1/predict/inference-cycle',
} as const;

export const getHealth = (options?: any) => api.get('/api/v1/health', { timeout: 8000, ...options });
export const getDashboardLive = (options?: any) => api.get('/api/v1/dashboard/live', options);
export const getDistrictBounds = (options?: any) => api.get('/api/v1/spatial/district-bounds', options);
export const getInferenceCycle = (options?: any) => api.get('/api/v1/predict/inference-cycle', options);

export { api };
export default api;
