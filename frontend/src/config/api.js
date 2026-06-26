// frontend/src/config/api.js
import axios from 'axios';

// 1. dynamic base URL — set VITE_API_URL in .env for production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true // Important for CORS/Cookies
});

// 2. Request Interceptor: Add Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 3. Response Interceptor: Handle Auth Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Only redirect if not already on login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
                localStorage.clear();
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;