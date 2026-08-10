'use client';

/**
 * Modal and Sheet.
 *
 * Both sit on --surface-raised over a scrim, trap focus, close on Escape,
 * restore focus to whatever opened them and lock body scroll while open.
 * Modal titles are Playfair. Actions sit bottom right with the primary
 * rightmost.
 */

import { useCallback, useEffect, useId, useRef } from 'react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDismissable(open, onClose, panelRef) {
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE) || panel;
    first?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  actions,
  closeLabel = 'Close dialog',
  children,
  className,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  useDismissable(open, onClose, panelRef);

  const onScrimClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      <div className="cd-scrim" aria-hidden="true" />
      <div className="cd-modal-layer" onMouseDown={onScrimClick}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn('cd-modal', size === 'sm' && 'cd-modal--sm', size === 'lg' && 'cd-modal--lg', className)}
        >
          <IconButton className="cd-modal__close" icon="close" label={closeLabel} onClick={onClose} size="sm" />
          {title ? (
            <h2 id={titleId} className="cd-modal__title">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p id={descId} className="cd-modal__desc">
              {description}
            </p>
          ) : null}
          {children}
          {actions ? <div className="cd-modal__actions">{actions}</div> : null}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sheet                                                                      */
/* -------------------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  side = 'right',
  footer,
  closeLabel = 'Close panel',
  children,
  className,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  useDismissable(open, onClose, panelRef);

  if (!open) return null;

  return (
    <>
      <div className="cd-scrim" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn('cd-sheet', side === 'bottom' ? 'cd-sheet--bottom' : 'cd-sheet--right', className)}
      >
        {side === 'bottom' ? <span className="cd-sheet__grip" aria-hidden="true" /> : null}
        <div className="cd-sheet__header">
          <h2 id={titleId} className="font-display text-xl text-ink tracking-tight">
            {title}
          </h2>
          <IconButton icon="close" label={closeLabel} onClick={onClose} size="sm" />
        </div>
        <div className="cd-sheet__body">{children}</div>
        {footer ? <div className="cd-sheet__footer">{footer}</div> : null}
      </div>
    </>
  );
}

export default Modal;
