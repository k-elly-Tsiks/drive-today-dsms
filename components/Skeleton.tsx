'use client'

import React from 'react'

export function SkeletonBlock({
  w = '100%',
  h = '14px',
  r = '8px',
  style,
}: {
  w?: string | number
  h?: string | number
  r?: string | number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s infinite',
        ...style,
      }}
    />
  )
}

export function SkeletonRow({
  lines = 3,
  lineH = 12,
}: {
  lines?: number
  lineH?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} h={`${lineH}px`} w={i === 0 ? '60%' : i === 1 ? '85%' : '45%'} r={8} />
      ))}
    </div>
  )
}

// Inject shimmer keyframes once
if (typeof document !== 'undefined') {
  const id = 'skeleton-shimmer-keyframes'
  if (!document.getElementById(id)) {
    const s = document.createElement('style')
    s.id = id
    s.innerHTML = `@keyframes skeleton-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`
    document.head.appendChild(s)
  }
}

