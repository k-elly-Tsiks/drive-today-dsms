'use client'

import * as React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type DTButtonProps = {
  variant?: ButtonVariant
  className?: string
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit' | 'reset'
  children: React.ReactNode
}

export function DTButton({
  variant = 'secondary',
  className,
  disabled,
  onClick,
  type = 'button',
  children,
}: DTButtonProps) {
  const base: React.CSSProperties = {
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    padding: '10px 18px',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    userSelect: 'none',
    opacity: disabled ? 0.7 : 1,
  }

  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: '#ff5a00',
      color: '#ffffff',
      borderColor: 'transparent',
      boxShadow: '0 4px 12px rgba(255, 90, 0, 0.15)',
    },
    secondary: {
      background: '#ffffff',
      color: '#475569',
      borderColor: '#e2e8f0',
    },
    ghost: {
      background: 'transparent',
      color: '#1e293b',
      borderColor: 'transparent',
    },
  }

  const [hovered, setHovered] = React.useState(false)

  const hoverStyles: Partial<Record<ButtonVariant, React.CSSProperties>> = {
    primary: { background: '#e04f00', boxShadow: '0 6px 16px rgba(255, 90, 0, 0.25)', transform: 'translateY(-1px)' },
    secondary: { borderColor: '#ff5a00', color: '#ff5a00', background: '#fff1eb' },
    ghost: { background: '#f1f5f9' },
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
      style={{
        ...base,
        ...(styles[variant] ?? {}),
        ...(hovered && !disabled ? (hoverStyles[variant] ?? {}) : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

