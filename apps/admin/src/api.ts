import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

api.interceptors.request.use((config) => {
  if (csrfToken) {
    config.headers.set('X-CSRF-Token', csrfToken);
  }
  return config;
});
