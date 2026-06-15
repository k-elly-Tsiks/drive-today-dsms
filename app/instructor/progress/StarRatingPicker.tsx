'use client'

import React from 'react'

export type StarRatingPickerProps = {
  value: number
  onChange: (v: number) => void
  label: string
  blue: string
  orange: string
}

export default function StarRatingPicker({
  value,
  onChange,
  label,
  blue,
  orange,
}: StarRatingPickerProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
        {label}
      </label>

      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: 'none',
              background: star <= value ? `linear-gradient(135deg, ${blue}, ${orange})` : '#f3f4f6',
              color: star <= value ? 'white' : '#9ca3af',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: '700',
              transition: 'all 0.15s ease',
            }}
          >
            {star}
          </button>
        ))}
      </div>

      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
        {value === 0
          ? 'Not rated'
          : value === 1
            ? 'Poor'
            : value === 2
              ? 'Below Average'
              : value === 3
                ? 'Average'
                : value === 4
                  ? 'Good'
                  : 'Excellent'}
      </p>
    </div>
  )
}

