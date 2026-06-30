import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-th-accent text-th-accent-fg hover:opacity-90 transition-opacity',
  secondary: 'border border-th-border text-th-muted hover:bg-th-hover transition-colors',
  danger:    'bg-red-500 text-white hover:bg-red-600 transition-colors',
  ghost:     'text-th-muted hover:text-th-text hover:bg-th-hover transition-colors',
};

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-xl text-sm font-semibold disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
