'use client';

import { useState, useCallback } from 'react';

export interface Toast {
    id: string;
    title: string;
    description?: string;
    variant?: 'default' | 'destructive' | 'success' | 'warning';
    duration?: number;
}

export interface ToastOptions {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive' | 'success' | 'warning';
    duration?: number;
}

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const toast = useCallback((options: ToastOptions) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast: Toast = {
            id,
            title: options.title,
            description: options.description,
            variant: options.variant || 'default',
            duration: options.duration || 5000,
        };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove toast after duration
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, newToast.duration);

        return id;
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    return {
        toast,
        dismiss,
        dismissAll,
        toasts,
    };
}

// Simple toast display function for basic notifications
export function showSimpleToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // Create a simple DOM-based toast notification
    const toastId = 'simple-toast-' + Date.now();
    const toast = document.createElement('div');
    
    const getToastStyles = (type: string) => {
        const baseStyles = 'fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg max-w-sm transition-all duration-300 ease-in-out';
        switch (type) {
            case 'success':
                return `${baseStyles} bg-green-50 border-green-200 text-green-800`;
            case 'error':
                return `${baseStyles} bg-red-50 border-red-200 text-red-800`;
            default:
                return `${baseStyles} bg-blue-50 border-blue-200 text-blue-800`;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success':
                return '✅';
            case 'error':
                return '❌';
            default:
                return 'ℹ️';
        }
    };

    toast.id = toastId;
    toast.className = getToastStyles(type);
    toast.innerHTML = `
        <div class="flex items-start space-x-2">
            <span class="text-lg">${getIcon(type)}</span>
            <span class="text-sm">${message}</span>
            <button onclick="document.getElementById('${toastId}').remove()" class="ml-auto text-sm opacity-70 hover:opacity-100">×</button>
        </div>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (document.getElementById(toastId)) {
            document.getElementById(toastId)?.remove();
        }
    }, 5000);
}
