/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const listeners = new Set();

const notify = (toast) => {
  listeners.forEach((listener) => listener(toast));
};

export const useToast = () => {
  const showToast = useCallback((message, type = 'info') => {
    notify({ message, type });
  }, []);

  return {
    success: (message) => showToast(message, 'success'),
    error: (message) => showToast(message, 'error'),
    info: (message) => showToast(message, 'info'),
    warning: (message) => showToast(message, 'warning'),
  };
};



export const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const addToast = (toast) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...toast, id }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };

    listeners.add(addToast);
    return () => listeners.delete(addToast);
  }, []);

  const getToastStyles = (type) => {
    const base = {
      padding: '12px 18px',
      borderRadius: '10px',
      color: '#fff',
      fontWeight: '600',
      fontSize: '0.88rem',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '280px',
      maxWidth: '420px',
      animation: 'toast-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      borderLeft: '5px solid',
      pointerEvents: 'auto'
    };

    switch (type) {
      case 'success':
        return {
          ...base,
          backgroundColor: '#10b981',
          borderLeftColor: '#059669',
          icon: '✅'
        };
      case 'error':
        return {
          ...base,
          backgroundColor: '#ef4444',
          borderLeftColor: '#dc2626',
          icon: '❌'
        };
      case 'warning':
        return {
          ...base,
          backgroundColor: '#f59e0b',
          borderLeftColor: '#d97706',
          icon: '⚠️'
        };
      default:
        return {
          ...base,
          backgroundColor: '#3b82f6',
          borderLeftColor: '#2563eb',
          icon: 'ℹ️'
        };
    }
  };

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}>
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type);
          const { icon, ...styleProps } = styles;
          return (
            <div
              key={toast.id}
              style={styleProps}
            >
              <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1 }}>{toast.message}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};
