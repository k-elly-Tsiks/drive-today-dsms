'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type ProgressRecord = {
  progress_id: string
  recorded_at: string
  steering_rating: number
  parking_rating: number
  reversing_rating: number
  road_awareness_rating: number
  comments?: string
  instructor?: { first_name: string; surname: string }
  booking?: { lesson_slots?: { slot_date: string; slot_time: string } }
}

const supabase = createClient()

export default function LearnerProgressPage() {
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Sync theme state with layout
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const theme = {
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    hoverBg: isDarkMode ? '#1e2433' : '#f8fafc',
  }

  // ─── Data fetching ────────────────────────────────────────────────────────────

  const loadProgress = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data } = await supabase
      .from('progress_tracking')
      .select(`
        *,
        instructor:users!progress_tracking_instructor_id_fkey (
          first_name, surname
        ),
        booking:lesson_bookings!progress_tracking_booking_id_fkey (
          lesson_slots (slot_date, slot_time)
        )
      `)
      .eq('learner_id', user.id)
      .order('recorded_at', { ascending: false })

    setProgressRecords(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadProgress()
    }
    init()
    return () => { cancelled = true }
  }, [loadProgress])

  // ─── Helper functions ─────────────────────────────────────────────────────────

  function avgRating(record: ProgressRecord) {
    const ratings = [
      record.steering_rating,
      record.parking_rating,
      record.reversing_rating,
      record.road_awareness_rating,
    ].filter((r): r is number => r !== null && r !== undefined)
    if (!ratings.length) return 0
    return (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  }

  function ratingColour(rating: number) {
    if (rating >= 4) return '#059669'
    if (rating >= 3) return orange
    return '#dc2626'
  }

  function stars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? orange : '#e5e7eb', fontSize: '16px' }}>★</span>
    ))
  }

  // ─── Derived averages ─────────────────────────────────────────────────────────

  const avg = (key: keyof ProgressRecord) =>
    progressRecords.length > 0
      ? (progressRecords.reduce((s, r) => s + (Number(r[key]) || 0), 0) / progressRecords.length).toFixed(1)
      : '0.0'

  const overallAvgSteering  = avg('steering_rating')
  const overallAvgParking   = avg('parking_rating')
  const overallAvgReversing = avg('reversing_rating')
  const overallAvgRoad      = avg('road_awareness_rating')

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.textMain, fontWeight: '600' }}>Loading Progress...</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: theme.textMain }}>

      {/* Subpage description */}
      <div style={{ marginBottom: '4px' }}>
        <p style={{ color: theme.textMuted, fontSize: '14px', margin: 0 }}>Track your skill ratings across all lessons</p>
      </div>

      {progressRecords.length === 0 ? (
        <div style={{ background: theme.cardBg, borderRadius: '14px', padding: '60px', textAlign: 'center', border: `1px solid ${theme.border}` }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📈</p>
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>No progress records yet</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            Your instructor will record your progress after each completed lesson
          </p>
        </div>
      ) : (
        <>
          {/* Overall Summary */}
          <div style={{
            background: `linear-gradient(135deg, ${blue}, #2d4fa3)`,
            borderRadius: '16px', padding: '24px 28px', marginBottom: '24px',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: '0 0 16px' }}>
              Overall Performance Summary — {progressRecords.length} lesson(s) assessed
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Steering',       icon: '🎯', value: overallAvgSteering },
                { label: 'Parking',        icon: '🅿', value: overallAvgParking },
                { label: 'Reversing',      icon: '🔄', value: overallAvgReversing },
                { label: 'Road Awareness', icon: '👁', value: overallAvgRoad },
              ].map((skill, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '22px' }}>{skill.icon}</p>
                  <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: 'white' }}>{skill.value}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{skill.label}</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${(Number(skill.value) / 5) * 100}%`, height: '100%', background: orange, borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Records */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progressRecords.map((record, index) => {
              const recordAvg = Number(avgRating(record))
              const isExpanded = expandedRecord === record.progress_id

              return (
                <div key={record.progress_id} style={{ background: theme.cardBg, borderRadius: '14px', border: `1px solid ${theme.border}`, overflow: 'hidden', borderLeft: `4px solid ${ratingColour(recordAvg)}` }}>

                  {/* Header */}
                  <div onClick={() => setExpandedRecord(isExpanded ? null : record.progress_id)}
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isDarkMode ? '#1e2433' : lightBlue, border: isDarkMode ? `1px solid ${theme.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDarkMode ? orange : blue, fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>
                        {progressRecords.length - index}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: theme.textMain }}>
                          Lesson {progressRecords.length - index}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>
                          {record.instructor?.first_name} {record.instructor?.surname} •{' '}
                          {new Date(record.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: ratingColour(recordAvg) }}>
                          {recordAvg}/5
                        </p>
                        <div>{stars(Math.round(recordAvg))}</div>
                      </div>
                      <span style={{ color: theme.textMuted, fontSize: '16px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', margin: '16px 0' }}>
                        {[
                          { label: 'Steering',       icon: '🎯', value: record.steering_rating },
                          { label: 'Parking',        icon: '🅿', value: record.parking_rating },
                          { label: 'Reversing',      icon: '🔄', value: record.reversing_rating },
                          { label: 'Road Awareness', icon: '👁', value: record.road_awareness_rating },
                        ].map((skill, i) => (
                          <div key={i} style={{ background: isDarkMode ? '#1e2433' : lightBlue, border: isDarkMode ? `1px solid ${theme.border}` : 'none', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 4px', fontSize: '22px' }}>{skill.icon}</p>
                            <p style={{ margin: '0 0 4px', fontSize: '11px', color: theme.textMuted }}>{skill.label}</p>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: ratingColour(skill.value) }}>{skill.value}</p>
                            <div style={{ marginTop: '4px' }}>{stars(skill.value)}</div>
                          </div>
                        ))}
                      </div>

                      {record.comments && (
                        <div style={{ background: isDarkMode ? 'rgba(253,230,138,0.1)' : '#fffbeb', borderRadius: '10px', padding: '14px 16px', border: `1px solid ${isDarkMode ? 'rgba(253,230,138,0.2)' : '#fde68a'}` }}>
                          <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: isDarkMode ? '#fde68a' : '#92400e' }}>💬 Instructor Comments</p>
                          <p style={{ margin: 0, fontSize: '13px', color: theme.textMain, lineHeight: '1.6' }}>{record.comments}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
