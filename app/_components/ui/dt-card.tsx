'use client'

import * as React from 'react'
import { dtTheme } from './learner-instructor-theme'

type DTCardProps = {
  children: React.ReactNode
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement>
}

export function DTCard({ children, className, onClick }: DTCardProps) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const theme = {
    cardBg: isDark ? dtTheme.cardBg.dark : dtTheme.cardBg.light,
    border: isDark ? dtTheme.border.dark : dtTheme.border.light,
  }

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: theme.cardBg,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${theme.border}`,
        boxShadow: '0 4px 18px rgba(0,0,0,0.02)',
        ...(onClick ? { cursor: 'pointer' } : null),
      }}
    >
      {children}
    </div>
  )
}

