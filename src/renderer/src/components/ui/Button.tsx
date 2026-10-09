import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong dark:text-[#14161c] disabled:opacity-50',
  secondary:
    'border border-border bg-surface text-text hover:bg-accent-soft disabled:opacity-50',
  ghost: 'text-muted hover:bg-accent-soft hover:text-text disabled:opacity-50',
  danger: 'text-danger hover:bg-danger/10 disabled:opacity-50'
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): React.JSX.Element {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
