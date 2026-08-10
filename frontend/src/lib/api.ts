import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60-second timeout — allows enough time for backend cold start
});

// ── Request Interceptor: inject auth token ────────────────────────────────────
api.interceptors.request.use(
  (config) => {
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

// ── Response Interceptor: retry GET requests up to 2 times on network error ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    // Only retry on network errors / 5xx, not on 4xx (auth/validation issues)
    const isRetryable =
      !error.response || error.response.status >= 500;
    const isGet = config.method?.toLowerCase() === 'get';
    const retryCount = config.__retryCount ?? 0;

    if (isGet && isRetryable && retryCount < 2) {
      config.__retryCount = retryCount + 1;
      // Exponential backoff: 500ms, 1000ms
      const delay = 500 * Math.pow(2, retryCount);
      await new Promise((res) => setTimeout(res, delay));
      return api(config);
    }

    return Promise.reject(error);
  },
);

export { api };
export default api;
