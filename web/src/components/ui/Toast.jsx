'use client';

/**
 * Toast: bottom right, hairline border, a status bar down the leading edge,
 * auto dismiss with the timer paused while the pointer or keyboard focus is
 * on the toast.
 *
 * Announced through an aria-live region so a screen reader gets the message
 * without the toast stealing focus.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../Icon';
import { IconButton } from './Button';

const ToastContext = createContext(null);

const TONE_ICON = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alertTriangle',
  danger: 'alertCircle',
};

const TONE_CLASS = {
  info: '',
  success: 'cd-toast--success',
  warning: 'cd-toast--warning',
  danger: 'cd-toast--danger',
};

export function ToastItem({ toast, onDismiss }) {
  const { id, title, description, tone = 'info', duration = 5000, action } = toast;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused || duration <= 0) return undefined;
    startedAt.current = Date.now();
    const t = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
      clearTimeout(t);
    };
  }, [paused, duration, id, onDismiss]);

  return (
    <div
      className={cn('cd-toast', TONE_CLASS[tone])}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span className="cd-toast__icon">
        <Icon name={TONE_ICON[tone]} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="cd-toast__title">{title}</p>
        {description ? <p className="cd-toast__desc">{description}</p> : null}
        {action ? (
          <button type="button" className="cd-btn cd-btn--tertiary cd-btn--sm mt-2" onClick={action.onClick}>
            <span className="cd-btn__label">{action.label}</span>
          </button>
        ) : null}
      </div>
      <IconButton icon="close" label="Dismiss notification" size="sm" onClick={() => onDismiss(id)} />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, ...options }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="cd-toast-layer" role="region" aria-label="Notifications">
        <div aria-live="polite" aria-atomic="false" className="contents">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Falling back to a no op keeps primitives usable outside the provider, for
  // example inside the gallery, without throwing.
  return ctx || { toast: () => 0, dismiss: () => {} };
}

export default ToastProvider;
