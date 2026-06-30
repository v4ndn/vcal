import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base =
  'w-full border border-th-border rounded-xl px-3 py-2 text-sm text-th-text bg-th-surface outline-none focus:border-th-subtle transition-colors';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} placeholder:text-th-muted/50 ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} placeholder:text-th-muted/50 resize-none ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${base} appearance-none ${className}`} {...props} />;
}
