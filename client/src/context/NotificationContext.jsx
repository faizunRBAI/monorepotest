import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const NotificationContext = createContext(null);

const TOAST_DURATION = 3600;

const typeConfig = {
    success: {
        icon: CheckCircle2,
        title: 'Done',
        accent: '#1e9b63'
    },
    error: {
        icon: XCircle,
        title: 'Something Went Wrong',
        accent: '#d64545'
    },
    warning: {
        icon: AlertTriangle,
        title: 'Check This',
        accent: '#d38b16'
    },
    info: {
        icon: Info,
        title: 'Notice',
        accent: '#1d6fd6'
    }
};

const guessNotificationType = (message = '') => {
    const normalized = message.toLowerCase();

    if (/(failed|error|invalid|cannot|required|not found|incorrect|not allowed)/.test(normalized)) {
        return 'error';
    }

    if (/(cancelled|warning|type "delete"|maximum|empty)/.test(normalized)) {
        return 'warning';
    }

    if (/(success|updated|uploaded|saved|placed|created|deleted|submitted|added)/.test(normalized)) {
        return 'success';
    }

    return 'info';
};

export const NotificationProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [dialog, setDialog] = useState(null);
    const restoreRef = useRef({ alert: null });

    const dismissToast = (id) => {
        setToasts(current => current.filter(toast => toast.id !== id));
    };

    const notify = (message, options = {}) => {
        if (!message) return;

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const type = options.type || guessNotificationType(message);
        const toast = {
            id,
            type,
            title: options.title || typeConfig[type]?.title || 'Notice',
            message,
            duration: options.duration ?? TOAST_DURATION
        };

        setToasts(current => [...current, toast]);

        if (toast.duration > 0) {
            window.setTimeout(() => dismissToast(id), toast.duration);
        }
    };

    const confirm = (options) => new Promise(resolve => {
        setDialog({
            kind: 'confirm',
            title: options?.title || 'Please Confirm',
            message: options?.message || 'Are you sure you want to continue?',
            confirmLabel: options?.confirmLabel || 'Confirm',
            cancelLabel: options?.cancelLabel || 'Cancel',
            tone: options?.tone || 'danger',
            resolve
        });
    });

    const prompt = (options) => new Promise(resolve => {
        setDialog({
            kind: 'prompt',
            title: options?.title || 'Enter a Value',
            message: options?.message || '',
            confirmLabel: options?.confirmLabel || 'Continue',
            cancelLabel: options?.cancelLabel || 'Cancel',
            placeholder: options?.placeholder || '',
            initialValue: options?.initialValue || '',
            tone: options?.tone || 'warning',
            resolve
        });
    });

    const closeDialog = (result) => {
        if (dialog?.resolve) {
            dialog.resolve(result);
        }
        setDialog(null);
    };

    useEffect(() => {
        restoreRef.current.alert = window.alert;
        window.alert = (message) => {
            notify(String(message ?? ''));
        };

        return () => {
            if (restoreRef.current.alert) {
                window.alert = restoreRef.current.alert;
            }
        };
    }, []);

    const value = useMemo(() => ({
        notify,
        confirm,
        prompt
    }), []);

    const dialogTone = dialog?.tone === 'danger' ? '#d64545' : dialog?.tone === 'warning' ? '#d38b16' : '#1d6fd6';

    return (
        <NotificationContext.Provider value={value}>
            {children}

            <div className="notification-layer" aria-live="polite" aria-atomic="true">
                {toasts.map(toast => {
                    const config = typeConfig[toast.type] || typeConfig.info;
                    const Icon = config.icon;

                    return (
                        <div
                            key={toast.id}
                            className="toast-card"
                            style={{ '--toast-accent': config.accent }}
                        >
                            <div className="toast-icon-wrap">
                                <Icon size={18} />
                            </div>
                            <div className="toast-copy">
                                <strong>{toast.title}</strong>
                                <p>{toast.message}</p>
                            </div>
                            <button
                                type="button"
                                className="toast-close"
                                onClick={() => dismissToast(toast.id)}
                                aria-label="Dismiss notification"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {dialog && (
                <div className="notification-dialog-backdrop" onClick={() => closeDialog(dialog.kind === 'confirm' ? false : null)}>
                    <div className="notification-dialog" onClick={e => e.stopPropagation()}>
                        <div className="notification-dialog-header">
                            <span className="notification-dialog-badge" style={{ '--dialog-accent': dialogTone }}>
                                {dialog.kind === 'prompt' ? 'Input Required' : 'Please Confirm'}
                            </span>
                            <h3>{dialog.title}</h3>
                            {dialog.message && <p>{dialog.message}</p>}
                        </div>

                        {dialog.kind === 'prompt' && (
                            <PromptInput
                                dialog={dialog}
                                closeDialog={closeDialog}
                            />
                        )}

                        {dialog.kind === 'confirm' && (
                            <div className="notification-dialog-actions">
                                <button type="button" className="notification-btn notification-btn-secondary" onClick={() => closeDialog(false)}>
                                    {dialog.cancelLabel}
                                </button>
                                <button
                                    type="button"
                                    className="notification-btn notification-btn-primary"
                                    style={{ '--dialog-accent': dialogTone }}
                                    onClick={() => closeDialog(true)}
                                >
                                    {dialog.confirmLabel}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

const PromptInput = ({ dialog, closeDialog }) => {
    const [value, setValue] = useState(dialog.initialValue || '');

    return (
        <>
            <input
                autoFocus
                className="notification-prompt-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={dialog.placeholder}
            />
            <div className="notification-dialog-actions">
                <button type="button" className="notification-btn notification-btn-secondary" onClick={() => closeDialog(null)}>
                    {dialog.cancelLabel}
                </button>
                <button
                    type="button"
                    className="notification-btn notification-btn-primary"
                    style={{ '--dialog-accent': dialog.tone === 'danger' ? '#d64545' : dialog.tone === 'warning' ? '#d38b16' : '#1d6fd6' }}
                    onClick={() => closeDialog(value)}
                >
                    {dialog.confirmLabel}
                </button>
            </div>
        </>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error('useNotification must be used inside NotificationProvider');
    }

    return context;
};
