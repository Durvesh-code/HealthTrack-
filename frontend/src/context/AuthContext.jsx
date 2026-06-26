import { createContext, useState, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../config/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      setLoading(false);
      return;
    }

    try {
      // 1. Try to verify with backend
      // We explicitly set the header here just to be safe
      const response = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.user) {
        // Backend confirmed token is valid
        // Merge stored data with fresh data (optional, but good practice)
        const freshUser = { ...JSON.parse(storedUser), ...response.data.user };
        setUser(freshUser);
      } else {
        // If response weird, force logout instead of staying in a broken state
        logout();
      }

    } catch (error) {
      console.error('Auth check failed:', error);
      
      // We rely on the global Axios interceptor (in api.js) to handle 401 redirects.
      // We only fall back to stored user if it's a network error (e.g., server down).
      if (!error.response || error.response.status !== 401) {
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (formData) => {
    try {
      const response = await api.post('/auth/login', formData);
      if (response.data.token) {
        const { token, role, user_name, id } = response.data;
        const userData = { id, role, name: user_name, token };

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
    } catch (error) {
        console.error("Login failed", error);
        throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    // Force redirect to prevent protected route loops
    window.location.href = '/'; 
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    role: user?.role,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};