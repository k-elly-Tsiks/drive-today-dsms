'use client'

import * as React from 'react'
import { dtTheme } from './learner-instructor-theme'

type DTSkeletonProps = {
  w?: string
  h?: string
  r?: string
}

export function DTSkeleton({ w = '100%', h = '14px', r = '6px' }: DTSkeletonProps) {
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: isDark ? dtTheme.shimmerBg.dark : dtTheme.shimmerBg.light,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

