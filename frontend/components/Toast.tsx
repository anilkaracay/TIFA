"use client";

import React, { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: ToastType, message: string, duration: number = 5000) => {
        const id = Math.random().toString(36).substring(7);
        const toast: Toast = { id, type, message, duration };
        
        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        // Fallback if not wrapped in provider
        return {
            toasts: [],
            showToast: (type: ToastType, message: string) => {
                console.log(`[Toast] ${type}: ${message}`);
            },
            removeToast: () => {},
        };
    }
    return context;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    const styles = {
        container: {
            position: 'fixed' as const,
            top: '20px',
            right: '20px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '12px',
            pointerEvents: 'none' as const,
        },
        toast: {
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            padding: '12px 16px',
            minWidth: '300px',
            maxWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            pointerEvents: 'auto' as const,
            animation: 'slideIn 0.3s ease-out',
        },
        toastSuccess: {
            borderColor: '#16a34a',
            borderLeft: '4px solid #16a34a',
        },
        toastError: {
            borderColor: '#dc2626',
            borderLeft: '4px solid #dc2626',
        },
        toastInfo: {
            borderColor: '#2563eb',
            borderLeft: '4px solid #2563eb',
        },
        toastWarning: {
            borderColor: '#f59e0b',
            borderLeft: '4px solid #f59e0b',
        },
        message: {
            fontSize: '13px',
            color: '#1a1a1a',
            flex: 1,
        },
        closeButton: {
            background: 'none',
            border: 'none',
            fontSize: '18px',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '0',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        },
    };

    const getToastStyle = (type: ToastType) => {
        switch (type) {
            case 'success':
                return styles.toastSuccess;
            case 'error':
                return styles.toastError;
            case 'info':
                return styles.toastInfo;
            case 'warning':
                return styles.toastWarning;
        }
    };

    return (
        <div style={styles.container}>
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    style={{ ...styles.toast, ...getToastStyle(toast.type) }}
                >
                    <div style={styles.message}>{toast.message}</div>
                    <button
                        style={styles.closeButton}
                        onClick={() => removeToast(toast.id)}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

// Add CSS animation
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    if (!document.getElementById('toast-styles')) {
        style.id = 'toast-styles';
        document.head.appendChild(style);
    }
}


