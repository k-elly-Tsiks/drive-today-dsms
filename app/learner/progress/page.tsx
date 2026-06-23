'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, MessageSquareText, ParkingCircle, RotateCcw, Star, Target, TrendingUp, View } from 'lucide-react'

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

function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: r,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s infinite linear',
    }} />
  )
}

export default function LearnerProgressPage() {
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e293b'
  const orange = '#ff5a00'
  const lightBlue = '#fff2eb'

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
      <Star key={i} size={15} fill={i < rating ? orange : 'none'} color={i < rating ? orange : '#e5e7eb'} />
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
      <div style={{ minHeight: '100vh', background: '#f4f5f7', padding: '24px' }}>
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <Skeleton w="180px" h="26px" r="6px" />
            <div style={{ marginTop: '8px' }}><Skeleton w="300px" h="13px" r="4px" /></div>
          </div>
          <Skeleton w="116px" h="38px" r="10px" />
        </div>
        <div style={{ background: blue, borderRadius: '16px', padding: '24px 28px', marginBottom: '24px' }}>
          <Skeleton w="240px" h="13px" r="4px" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '16px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Skeleton w="34px" h="22px" r="6px" />
                <Skeleton w="48px" h="26px" r="6px" />
                <Skeleton w="86px" h="11px" r="4px" />
                <Skeleton w="100%" h="4px" r="2px" />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${orange}`, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <Skeleton w="40px" h="40px" r="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton w="140px" h="14px" r="4px" />
                  <div style={{ marginTop: '8px' }}><Skeleton w="220px" h="11px" r="4px" /></div>
                </div>
              </div>
              <div style={{ width: '90px' }}>
                <Skeleton w="60px" h="22px" r="5px" />
                <div style={{ marginTop: '8px' }}><Skeleton w="90px" h="16px" r="4px" /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>My Progress</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Track your skill ratings across all lessons</p>
        </div>
        <button
          onClick={() => router.push('/learner/dashboard')}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
      </div>

      {progressRecords.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <TrendingUp size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>No progress records yet</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            Your instructor will record your progress after each completed lesson
          </p>
        </div>
      ) : (
        <>
          {/* Overall Summary */}
          <div style={{
            background: blue,
            borderRadius: '16px', padding: '24px 28px', marginBottom: '24px',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: '0 0 16px' }}>
              Overall Performance Summary — {progressRecords.length} lesson(s) assessed
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Steering',       icon: <Target size={18} color="#ffffff" />, value: overallAvgSteering },
                { label: 'Parking',        icon: <ParkingCircle size={18} color="#ffffff" />, value: overallAvgParking },
                { label: 'Reversing',      icon: <RotateCcw size={18} color="#ffffff" />, value: overallAvgReversing },
                { label: 'Road Awareness', icon: <View size={18} color="#ffffff" />, value: overallAvgRoad },
              ].map((skill, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>{skill.icon}</div>
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
                <div key={record.progress_id} style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', borderLeft: `4px solid ${ratingColour(recordAvg)}` }}>

                  {/* Header */}
                  <div onClick={() => setExpandedRecord(isExpanded ? null : record.progress_id)}
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: lightBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', color: blue, fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>
                        {progressRecords.length - index}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                          Lesson {progressRecords.length - index}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
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
                      <ChevronDown size={18} color="#9ca3af" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', margin: '16px 0' }}>
                        {[
                          { label: 'Steering',       icon: <Target size={18} color={orange} />, value: record.steering_rating },
                          { label: 'Parking',        icon: <ParkingCircle size={18} color={orange} />, value: record.parking_rating },
                          { label: 'Reversing',      icon: <RotateCcw size={18} color={orange} />, value: record.reversing_rating },
                          { label: 'Road Awareness', icon: <View size={18} color={orange} />, value: record.road_awareness_rating },
                        ].map((skill, i) => (
                          <div key={i} style={{ background: lightBlue, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', marginBottom: '6px' }}>{skill.icon}</div>
                            <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#6b7280' }}>{skill.label}</p>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: ratingColour(skill.value) }}>{skill.value}</p>
                            <div style={{ marginTop: '4px' }}>{stars(skill.value)}</div>
                          </div>
                        ))}
                      </div>

                      {record.comments && (
                        <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '14px 16px', border: '1px solid #fde68a' }}>
                          <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquareText size={14} /> Instructor Comments</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>{record.comments}</p>
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
