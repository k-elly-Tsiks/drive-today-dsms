'use client'

import * as React from 'react'
import { dtTheme } from './learner-instructor-theme'

type DTStatCardProps = {
  label: string
  value: string | number
  sub: string
  badgeBg: string
  icon: React.ReactNode
  onClick?: () => void
}

export function DTStatCard({ label, value, sub, badgeBg, icon, onClick }: DTStatCardProps) {
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const theme = {
    cardBg: isDark ? dtTheme.cardBg.dark : dtTheme.cardBg.light,
    textMain: isDark ? dtTheme.textMain.dark : dtTheme.textMain.light,
    textMuted: isDark ? dtTheme.textMuted.dark : dtTheme.textMuted.light,
    border: isDark ? dtTheme.border.dark : dtTheme.border.light,
    primaryOrange: dtTheme.primaryAccent,
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: theme.cardBg,
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 4px 18px rgba(0,0,0,0.02)',
        border: `1px solid ${theme.border}`,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={e => {
        if (!onClick) return
        ;(e.currentTarget as HTMLDivElement).style.borderColor = theme.primaryOrange
      }}
      onMouseLeave={e => {
        if (!onClick) return
        ;(e.currentTarget as HTMLDivElement).style.borderColor = theme.border
      }}
    >
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 12.5, color: theme.textMuted, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: theme.textMain, letterSpacing: '-0.5px' }}>
          {value}
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: theme.textMuted }}>{sub}</p>
      </div>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  )
}

