// src/lib/apiClient.ts
import axios, { CanceledError } from 'axios';
import { isTokenExpired, signalSessionExpired } from '../features/auth/session';

export const wsUrl = import.meta.env.VITE_API_WS_URL || 'ws://localhost:5001/api'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Automatically attach token if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  //console.log('Interceptor triggered. Token:', token);
  // An expired token would only get a 401: end the session and cancel the request instead
  if (token && isTokenExpired(token)) {
    signalSessionExpired();
    throw new CanceledError('Session expired');
  }
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Optional: Global error handler
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log or handle common errors globally
    if (error.response?.status === 401) {
      console.warn('Unauthorized');
      signalSessionExpired();
    }
    return Promise.reject(error);
  }
);

export default apiClient;