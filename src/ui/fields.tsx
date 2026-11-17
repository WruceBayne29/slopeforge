import { useState } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Decimals shown when not being edited. */
  decimals?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

/** A number input that commits on Enter or blur and puts back the old value if it cannot parse. */
export function NumberField({
  label,
  value,
  onChange,
  decimals = 2,
  min,
  max,
  step,
  disabled,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : '';
  const commit = (): void => {
    if (draft === null) return;
    const parsed = Number(draft.replace(',', '.'));
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(parsed)) return;
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (next !== value) onChange(next);
  };
  return (
    <input
      className={`num ${className ?? ''}`}
      type="text"
      inputMode="decimal"
      aria-label={label}
      title={label}
      disabled={disabled}
      value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && step) {
          e.preventDefault();
          const base = draft !== null && Number.isFinite(Number(draft)) ? Number(draft) : value;
          let next = base + (e.key === 'ArrowUp' ? step : -step);
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          setDraft(null);
          onChange(Number(next.toFixed(6)));
        }
      }}
    />
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TextField({ label, value, onChange, className }: TextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={className}
      type="text"
      aria-label={label}
      title={label}
      maxLength={80}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onChange(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
