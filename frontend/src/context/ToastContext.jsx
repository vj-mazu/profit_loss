import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title = '', message = '', duration = 6000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, type, title, message };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const success = useCallback((message, title = 'Saved Successfully') => {
    return addToast({ type: 'success', title, message, duration: 5000 });
  }, [addToast]);

  const error = useCallback((message, title = 'Action Failed') => {
    return addToast({ type: 'error', title, message, duration: 9000 });
  }, [addToast]);

  const warning = useCallback((message, title = 'Validation Notice') => {
    return addToast({ type: 'warning', title, message, duration: 7000 });
  }, [addToast]);

  const info = useCallback((message, title = 'Notice') => {
    return addToast({ type: 'info', title, message, duration: 5000 });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}

      {/* Floating In-App Toast Notification Container */}
      <div 
        aria-live="assertive" 
        className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2.5 max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const bgBorder = isSuccess
            ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500 shadow-emerald-900/40'
            : isError
            ? 'bg-rose-950/95 text-rose-100 border-rose-500 shadow-rose-900/40'
            : isWarning
            ? 'bg-amber-950/95 text-amber-100 border-amber-500 shadow-amber-900/40'
            : 'bg-slate-900/95 text-slate-100 border-blue-500 shadow-blue-900/40';

          const iconColor = isSuccess
            ? 'text-emerald-400'
            : isError
            ? 'text-rose-400'
            : isWarning
            ? 'text-amber-400'
            : 'text-blue-400';

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto p-4 rounded-xl border-2 shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 flex items-start space-x-3 ${bgBorder}`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className={`w-5 h-5 ${iconColor}`} />}
                {isError && <AlertCircle className={`w-5 h-5 ${iconColor}`} />}
                {isWarning && <AlertTriangle className={`w-5 h-5 ${iconColor}`} />}
                {!isSuccess && !isError && !isWarning && <Info className={`w-5 h-5 ${iconColor}`} />}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="text-xs font-black uppercase tracking-wider mb-0.5">
                  {t.title}
                </div>
                <div className="text-xs font-semibold leading-relaxed break-words opacity-95">
                  {t.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                title="Dismiss notification"
                className="shrink-0 p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
