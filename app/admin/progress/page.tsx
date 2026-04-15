'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Learner, Instructor, ProgressRecord } from './types'

const supabase = createClient()

export default function ProgressPage() {

  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null)
  const [selectedInstructor, setSelectedInstructor] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  // ─── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { routerRef.current.push('/login'); return }
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', user.id)
        .single()
      if (data?.role !== 'admin') routerRef.current.push('/login')
    }

    async function loadData() {
      setLoading(true)

      const { data: progressData } = await supabase
        .from('progress_tracking')
        .select(`
          *,
          learner:users!progress_tracking_learner_id_fkey (
            first_name, surname, email
          ),
          instructor:users!progress_tracking_instructor_id_fkey (
            first_name, surname
          ),
          booking:lesson_bookings!progress_tracking_booking_id_fkey (
            lesson_slots (slot_date, slot_time)
          )
        `)
        .order('recorded_at', { ascending: false })

      const { data: learnersData } = await supabase
        .from('users')
        .select('user_id, first_name, surname')
        .eq('role', 'learner')
        .eq('status', 'approved')
        .order('first_name', { ascending: true })

      const { data: instructorsData } = await supabase
        .from('users')
        .select('user_id, first_name, surname')
        .eq('role', 'instructor')
        .eq('status', 'approved')
        .order('first_name', { ascending: true })

      setProgressRecords(progressData || [])
      setLearners(learnersData || [])
      setInstructors(instructorsData || [])
      setLoading(false)
    }

    checkAdmin()
    loadData()
  }, [])

  // ─── Helper functions ────────────────────────────────────────────────────────

  function avgRating(record: ProgressRecord) {
    const ratings = [
      record.steering_rating,
      record.parking_rating,
      record.reversing_rating,
      record.road_awareness_rating,
    ].filter((r) => r !== null && r !== undefined)
    if (ratings.length === 0) return 0
    return (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  }

  function ratingColour(rating: number) {
    if (rating >= 4) return '#059669'
    if (rating >= 3) return orange
    return '#dc2626'
  }

  function stars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        style={{
          color: i < rating ? orange : '#e5e7eb',
          fontSize: '14px',
        }}
      >
        ★
      </span>
    ))
  }

  function getLearnerSummary(learnerId: string) {
    const records = progressRecords.filter((r) => r.learner_id === learnerId)
    if (records.length === 0) return null
    const avgSteering = records.reduce((s, r) => s + (r.steering_rating || 0), 0) / records.length
    const avgParking = records.reduce((s, r) => s + (r.parking_rating || 0), 0) / records.length
    const avgReversing = records.reduce((s, r) => s + (r.reversing_rating || 0), 0) / records.length
    const avgRoad = records.reduce((s, r) => s + (r.road_awareness_rating || 0), 0) / records.length
    return { avgSteering, avgParking, avgReversing, avgRoad, totalLessons: records.length }
  }

  // ─── Derived state ───────────────────────────────────────────────────────────

  const filteredRecords = progressRecords.filter((r) => {
    const matchesSearch =
      r.progress?.toString().toLowerCase().includes(search.toLowerCase()) ||
      r.comments?.toLowerCase().includes(search.toLowerCase())

    const matchesLearner =
      selectedLearner === null || r.learner_id === selectedLearner?.user_id

    const matchesInstructor =
      selectedInstructor === 'all' || r.instructor_id === selectedInstructor

    return matchesSearch && matchesLearner && matchesInstructor
  })

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: lightBlue,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px', fontWeight: '800', color: 'white',
          }}>DT</div>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Progress...</p>
      </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            📈 Progress Monitoring
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            View all learner progress records and skill ratings
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/dashboard')}
          style={{
            padding: '10px 18px', borderRadius: '10px',
            border: 'none', background: blue,
            color: 'white', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer',
          }}
        >
          ← Dashboard
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total Records', value: progressRecords.length, colour: blue },
          { label: 'Learners Assessed', value: new Set(progressRecords.map((r) => r.learner_id)).size, colour: orange },
          { label: 'Active Instructors', value: new Set(progressRecords.map((r) => r.instructor_id)).size, colour: '#059669' },
          {
            label: 'Avg Overall Rating',
            value: progressRecords.length > 0
              ? (progressRecords.reduce((s, r) => s + Number(avgRating(r)), 0) / progressRecords.length).toFixed(1)
              : '0.0',
            colour: '#7c3aed',
          },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: '12px',
            padding: '16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${stat.colour}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: stat.colour }}>
              {stat.value}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Learner Summaries */}
      {learners.filter((l) => getLearnerSummary(l.user_id)).length > 0 && (
        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '20px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: '0 0 16px' }}>
            📊 Learner Progress Summaries
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
          }}>
            {learners
              .filter((l) => getLearnerSummary(l.user_id))
              .map((learner) => {
                const summary = getLearnerSummary(learner.user_id)!
                return (
                  <div
                    key={learner.user_id}
                    style={{
                      background: lightBlue, borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: `linear-gradient(135deg, ${blue}, ${orange})`,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'white',
                        fontWeight: '700', fontSize: '13px', flexShrink: 0,
                      }}>
                        {learner.first_name.charAt(0)}{learner.surname.charAt(0)}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>
                          {learner.first_name} {learner.surname}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                          {summary.totalLessons} lesson(s) assessed
                        </p>
                      </div>
                    </div>

                    {[
                      { label: 'Steering', value: summary.avgSteering },
                      { label: 'Parking', value: summary.avgParking },
                      { label: 'Reversing', value: summary.avgReversing },
                      { label: 'Road Awareness', value: summary.avgRoad },
                    ].map((skill, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: '6px',
                      }}>
                        <span style={{ fontSize: '11px', color: '#374151', fontWeight: '500' }}>
                          {skill.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '80px', height: '6px',
                            background: '#e5e7eb', borderRadius: '3px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${(skill.value / 5) * 100}%`,
                              height: '100%',
                              background: ratingColour(skill.value),
                              borderRadius: '3px',
                            }} />
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: '700',
                            color: ratingColour(skill.value),
                            minWidth: '24px',
                          }}>
                            {skill.value.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '16px 20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '12px',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="🔍 Search by progress or comments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px',
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none',
          }}
        />

        {/* Learner filter */}
        <select
          value={selectedLearner?.user_id ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const learner = learners.find((l) => l.user_id === e.target.value)
            setSelectedLearner(learner ?? null)
          }}
          style={{
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none',
            background: 'white',
          }}
        >
          <option value="">All Learners</option>
          {learners.map((l) => (
            <option key={l.user_id} value={l.user_id}>
              {l.first_name} {l.surname}
            </option>
          ))}
        </select>

        {/* Instructor filter */}
        <select
          value={selectedInstructor}
          onChange={(e) => setSelectedInstructor(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none',
            background: 'white',
          }}
        >
          <option value="all">All Instructors</option>
          {instructors.map((i) => (
            <option key={i.user_id} value={i.user_id}>
              {i.first_name} {i.surname}
            </option>
          ))}
        </select>
      </div>

      {/* Progress Records */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredRecords.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '60px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>📈</p>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 4px' }}>
              No progress records found
            </p>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
              Progress records will appear here after instructors complete lessons
            </p>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const avg = avgRating(record)
            const isExpanded = expandedRecord === record.recorded_at

            return (
              <div
                key={record.recorded_at}
                style={{
                  background: 'white', borderRadius: '14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                  borderLeft: `4px solid ${ratingColour(Number(avg))}`,
                }}
              >
                {/* Record Header */}
                <div
                  onClick={() => setExpandedRecord(isExpanded ? null : record.recorded_at)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    {/* Learner avatar */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: lightBlue, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: blue, fontWeight: '700', fontSize: '14px',
                      flexShrink: 0,
                    }}>
                      {record.learner?.first_name?.charAt(0)}
                      {record.learner?.surname?.charAt(0)}
                    </div>

                    {/* Learner and lesson info */}
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                        {record.learner?.first_name} {record.learner?.surname}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                        Instructor: {record.instructor?.first_name} {record.instructor?.surname}
                        {record.booking?.lesson_slots?.slot_date && (
                          <> • {new Date(record.booking.lesson_slots.slot_date).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Average rating */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      margin: 0, fontSize: '20px', fontWeight: '800',
                      color: ratingColour(Number(avg)),
                    }}>
                      {avg}
                    </p>
                    <div>{stars(Math.round(Number(avg)))}</div>
                  </div>

                  {/* Expand arrow */}
                  <span style={{
                    color: '#9ca3af', fontSize: '16px',
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}>
                    ▼
                  </span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    padding: '0 20px 20px',
                    borderTop: '1px solid #f3f4f6',
                  }}>
                    {/* Skill ratings grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px', margin: '16px 0',
                    }}>
                      {[
                        { label: 'Steering', icon: '🎯', value: record.steering_rating },
                        { label: 'Parking', icon: '🅿', value: record.parking_rating },
                        { label: 'Reversing', icon: '🔄', value: record.reversing_rating },
                        { label: 'Road Awareness', icon: '👁', value: record.road_awareness_rating },
                      ].map((skill, i) => (
                        <div key={i} style={{
                          background: lightBlue, borderRadius: '10px',
                          padding: '12px', textAlign: 'center',
                        }}>
                          <p style={{ margin: '0 0 4px', fontSize: '20px' }}>{skill.icon}</p>
                          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#6b7280' }}>
                            {skill.label}
                          </p>
                          <p style={{
                            margin: 0, fontSize: '22px', fontWeight: '800',
                            color: ratingColour(skill.value),
                          }}>
                            {skill.value}
                          </p>
                          <div style={{ marginTop: '4px' }}>
                            {stars(skill.value)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Instructor comments */}
                    {record.comments && (
                      <div style={{
                        background: '#fffbeb', borderRadius: '10px',
                        padding: '14px 16px',
                        border: '1px solid #fde68a',
                      }}>
                        <p style={{
                          margin: '0 0 6px', fontSize: '12px',
                          fontWeight: '700', color: '#92400e',
                        }}>
                          💬 Instructor Comments
                        </p>
                        <p style={{
                          margin: 0, fontSize: '13px',
                          color: '#374151', lineHeight: '1.6',
                        }}>
                          {record.comments}
                        </p>
                      </div>
                    )}

                    {/* Recorded date */}
                    <p style={{
                      margin: '12px 0 0', fontSize: '11px',
                      color: '#9ca3af', textAlign: 'right',
                    }}>
                      Recorded on {new Date(record.recorded_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long',
                        year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
