'use client';

/**
 * Form primitives: Field, Input, Textarea, Select, Checkbox, Radio,
 * RadioGroup, Switch.
 *
 * One control height across the app. Label above, helper below, inline
 * validation in --danger with a message and an icon. There is never a bare red
 * outline with no explanation: setting `error` renders the message, and the
 * control points at it with aria-describedby.
 */

import { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../Icon';

/* -------------------------------------------------------------------------- */
/* Field wrapper                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `hideLabel` keeps the label in the accessibility tree and takes it off the
 * screen. It is for the case where a heading directly above the control
 * already says the same thing, and printing it twice would be noise.
 */
export function Field({ id, label, hideLabel = false, helper, error, optional = false, className, children }) {
  return (
    <div className={cn('cd-field', className)}>
      {label ? (
        <label className={hideLabel ? 'sr-only' : 'cd-field__label'} htmlFor={id}>
          {label}
          {optional ? <span className="cd-field__optional"> (optional)</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="cd-field__error" id={`${id}-error`} role="alert">
          <Icon name="alertCircle" size={14} />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p className="cd-field__helper" id={`${id}-helper`}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id, helper, error) {
  if (error) return `${id}-error`;
  if (helper) return `${id}-helper`;
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

export const Input = forwardRef(function Input(
  { id, label, hideLabel, helper, error, optional, iconStart, iconEnd, mono = false, className, wrapperClassName, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Field id={fieldId} label={label} hideLabel={hideLabel} helper={helper} error={error} optional={optional} className={wrapperClassName}>
      <div className="cd-inputwrap">
        {iconStart ? (
          <span className="cd-inputwrap__affix cd-inputwrap__affix--start">
            <Icon name={iconStart} size={16} />
          </span>
        ) : null}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(fieldId, helper, error)}
          className={cn(
            'cd-control',
            mono && 'cd-control--mono',
            iconStart && 'cd-control--pad-start',
            iconEnd && 'cd-control--pad-end',
            className,
          )}
          {...rest}
        />
        {iconEnd ? (
          <span className="cd-inputwrap__affix cd-inputwrap__affix--end">
            <Icon name={iconEnd} size={16} />
          </span>
        ) : null}
      </div>
    </Field>
  );
});

/* -------------------------------------------------------------------------- */
/* Textarea                                                                   */
/* -------------------------------------------------------------------------- */

export const Textarea = forwardRef(function Textarea(
  { id, label, hideLabel, helper, error, optional, rows = 3, className, wrapperClassName, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Field id={fieldId} label={label} hideLabel={hideLabel} helper={helper} error={error} optional={optional} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, helper, error)}
        className={cn('cd-control cd-control--textarea', className)}
        {...rest}
      />
    </Field>
  );
});

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

export const Select = forwardRef(function Select(
  { id, label, helper, error, optional, options = [], placeholder, className, wrapperClassName, children, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Field id={fieldId} label={label} helper={helper} error={error} optional={optional} className={wrapperClassName}>
      <div className="cd-selectwrap">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(fieldId, helper, error)}
          className={cn('cd-control cd-control--select', className)}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children ||
            options.map((o) => {
              const value = typeof o === 'string' ? o : o.value;
              const text = typeof o === 'string' ? o : o.label;
              return (
                <option key={value} value={value}>
                  {text}
                </option>
              );
            })}
        </select>
        <span className="cd-selectwrap__chevron">
          <Icon name="chevronDown" size={16} />
        </span>
      </div>
    </Field>
  );
});

/* -------------------------------------------------------------------------- */
/* Checkbox                                                                   */
/* -------------------------------------------------------------------------- */

export const Checkbox = forwardRef(function Checkbox(
  { id, label, description, checked = false, indeterminate = false, error = false, disabled = false, className, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <label
      htmlFor={fieldId}
      className={cn('cd-choice', disabled && 'cd-choice--disabled', className)}
    >
      <span className="cd-choice__box">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="cd-choice__input"
          checked={checked}
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : checked}
          aria-invalid={error ? 'true' : undefined}
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            'cd-checkbox',
            checked && !indeterminate && 'is-checked',
            indeterminate && 'is-indeterminate',
            error && 'is-invalid',
          )}
        >
          {indeterminate ? (
            <span className="cd-checkbox__bar" />
          ) : checked ? (
            <Icon name="check" size={13} strokeWidth={2.5} />
          ) : null}
        </span>
      </span>
      {label || description ? (
        <span className="cd-choice__text">
          {label ? <span className="cd-choice__label">{label}</span> : null}
          {description ? <span className="cd-choice__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});

/* -------------------------------------------------------------------------- */
/* Radio                                                                      */
/* -------------------------------------------------------------------------- */

export const Radio = forwardRef(function Radio(
  { id, name, label, description, checked = false, disabled = false, error = false, className, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <label htmlFor={fieldId} className={cn('cd-choice', disabled && 'cd-choice--disabled', className)}>
      <span className="cd-choice__box">
        <input
          ref={ref}
          id={fieldId}
          name={name}
          type="radio"
          className="cd-choice__input"
          checked={checked}
          disabled={disabled}
          {...rest}
        />
        <span aria-hidden="true" className={cn('cd-radio', checked && 'is-checked', error && 'is-invalid')}>
          {checked ? <span className="cd-radio__dot" /> : null}
        </span>
      </span>
      {label || description ? (
        <span className="cd-choice__text">
          {label ? <span className="cd-choice__label">{label}</span> : null}
          {description ? <span className="cd-choice__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});

export function RadioGroup({ legend, name, value, onChange, options = [], error, helper, className }) {
  const auto = useId();
  return (
    <fieldset className={cn('cd-field', className)} aria-invalid={error ? 'true' : undefined}>
      {legend ? <legend className="cd-field__label">{legend}</legend> : null}
      <div className="flex flex-col">
        {options.map((o) => (
          <Radio
            key={o.value}
            id={`${auto}-${o.value}`}
            name={name}
            label={o.label}
            description={o.description}
            disabled={o.disabled}
            error={Boolean(error)}
            checked={value === o.value}
            onChange={() => onChange?.(o.value)}
          />
        ))}
      </div>
      {error ? (
        <p className="cd-field__error" role="alert">
          <Icon name="alertCircle" size={14} />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p className="cd-field__helper">{helper}</p>
      ) : null}
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                     */
/* -------------------------------------------------------------------------- */

export const Switch = forwardRef(function Switch(
  { id, label, description, checked = false, disabled = false, className, onChange, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <label htmlFor={fieldId} className={cn('cd-choice', disabled && 'cd-choice--disabled', className)}>
      <span className="cd-choice__box">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          role="switch"
          className="cd-choice__input"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          {...rest}
        />
        <span aria-hidden="true" className={cn('cd-switch', checked && 'is-on')}>
          <span className="cd-switch__thumb" />
        </span>
      </span>
      {label || description ? (
        <span className="cd-choice__text">
          {label ? <span className="cd-choice__label">{label}</span> : null}
          {description ? <span className="cd-choice__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});
