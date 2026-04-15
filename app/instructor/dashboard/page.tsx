'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Lesson = {
  booking_id: string
  learner_id: string
  lesson_slots?: { slot_date: string; slot_time: string }
  learner?: { first_name: string; surname: string; phone_number?: string }
}

type ProgressRecord = {
  progress_id: string
  recorded_at: string
  steering_rating?: number
  parking_rating?: number
  reversing_rating?: number
  road_awareness_rating?: number
  learner?: { first_name: string; surname: string }
}

type InstructorProfile = { first_name: string; surname: string }

const supabase = createClient()

export default function InstructorDashboard() {
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null)
  const [todaysLessons, setTodaysLessons] = useState<Lesson[]>([])
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([])
  const [recentProgress, setRecentProgress] = useState<ProgressRecord[]>([])
  const [stats, setStats] = useState({ totalLessons: 0, completedLessons: 0, upcomingCount: 0, totalLearners: 0 })
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data: instructorData } = await supabase.from('users').select('*').eq('user_id', user.id).single()
    setInstructor(instructorData)

    const today = new Date().toISOString().split('T')[0]

    const { data: todayData } = await supabase
      .from('lesson_bookings')
      .select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number)`)
      .eq('instructor_id', user.id).eq('status', 'scheduled').eq('lesson_slots.slot_date', today)
      .order('lesson_slots(slot_time)', { ascending: true })
    setTodaysLessons(todayData || [])

    const { data: upcomingData } = await supabase
      .from('lesson_bookings')
      .select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname)`)
      .eq('instructor_id', user.id).eq('status', 'scheduled').gt('lesson_slots.slot_date', today)
      .order('lesson_slots(slot_date)', { ascending: true }).limit(5)
    setUpcomingLessons(upcomingData || [])

    const { count: totalCount } = await supabase.from('lesson_bookings').select('*', { count: 'exact', head: true }).eq('instructor_id', user.id)
    const { count: completedCount } = await supabase.from('lesson_bookings').select('*', { count: 'exact', head: true }).eq('instructor_id', user.id).eq('status', 'completed')
    const { count: upcomingCount } = await supabase.from('lesson_bookings').select('*', { count: 'exact', head: true }).eq('instructor_id', user.id).eq('status', 'scheduled')
    const { data: learnersData } = await supabase.from('lesson_bookings').select('learner_id').eq('instructor_id', user.id)
    const uniqueLearners = new Set(learnersData?.map(b => b.learner_id)).size

    setStats({ totalLessons: totalCount || 0, completedLessons: completedCount || 0, upcomingCount: upcomingCount || 0, totalLearners: uniqueLearners })

    const { data: progressData } = await supabase
      .from('progress_tracking')
      .select(`*, learner:users!progress_tracking_learner_id_fkey (first_name, surname)`)
      .eq('instructor_id', user.id).order('recorded_at', { ascending: false }).limit(3)
    setRecentProgress(progressData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await loadDashboard() }
    init()
    return () => { cancelled = true }
  }, [loadDashboard])

  function avgRating(record: ProgressRecord) {
    const ratings = [record.steering_rating, record.parking_rating, record.reversing_rating, record.road_awareness_rating]
      .filter((r): r is number => r !== null && r !== undefined)
    if (!ratings.length) return 0
    return (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  }

  function ratingColour(rating: number) {
    if (rating >= 4) return '#059669'
    if (rating >= 3) return orange
    return '#dc2626'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: `linear-gradient(135deg, ${blue}, ${orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: '800', color: 'white' }}>DT</div>
          <p style={{ color: blue, fontWeight: '600' }}>Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ background: `linear-gradient(135deg, ${blue}, #2d4fa3)`, borderRadius: '16px', padding: '24px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '800', margin: '0 0 4px' }}>Welcome back, {instructor?.first_name} 👋</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: 0 }}>
            {todaysLessons.length > 0 ? `You have ${todaysLessons.length} lesson(s) today` : 'No lessons scheduled for today'}
          </p>
        </div>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🚗</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Lessons', value: stats.totalLessons,     icon: '📅', colour: blue,      path: '/instructor/lessons' },
          { label: 'Completed',     value: stats.completedLessons, icon: '✅', colour: '#059669', path: '/instructor/lessons' },
          { label: 'Upcoming',      value: stats.upcomingCount,    icon: '⏰', colour: orange,    path: '/instructor/lessons' },
          { label: 'My Learners',   value: stats.totalLearners,    icon: '🎓', colour: '#7c3aed', path: '/instructor/lessons' },
        ].map((stat, i) => (
          <div key={i} onClick={() => router.push(stat.path)}
            style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${stat.colour}`, cursor: 'pointer', transition: 'transform 0.2s ease' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{stat.label}</p>
                <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
              </div>
              <span style={{ fontSize: '28px' }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* Today's Lessons */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: 0 }}>📅 Today&apos;s Lessons</h3>
            <button onClick={() => router.push('/instructor/lessons')} style={{ background: 'none', border: 'none', color: orange, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>View all →</button>
          </div>
          {todaysLessons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '28px', margin: '0 0 8px' }}>📅</p>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>No lessons today</p>
            </div>
          ) : todaysLessons.map((lesson, i) => (
            <div key={lesson.booking_id} style={{ padding: '10px 0', borderBottom: i < todaysLessons.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{lesson.learner?.first_name} {lesson.learner?.surname}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>📱 {lesson.learner?.phone_number}</p>
                </div>
                <div style={{ background: lightBlue, borderRadius: '8px', padding: '4px 10px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: blue }}>{lesson.lesson_slots?.slot_time?.slice(0, 5)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming Lessons */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: 0 }}>⏰ Upcoming Lessons</h3>
            <button onClick={() => router.push('/instructor/lessons')} style={{ background: 'none', border: 'none', color: orange, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>View all →</button>
          </div>
          {upcomingLessons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '28px', margin: '0 0 8px' }}>⏰</p>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>No upcoming lessons</p>
            </div>
          ) : upcomingLessons.map((lesson, i) => (
            <div key={lesson.booking_id} style={{ padding: '10px 0', borderBottom: i < upcomingLessons.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{lesson.learner?.first_name} {lesson.learner?.surname}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {lesson.lesson_slots?.slot_date ? new Date(lesson.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}
                  </p>
                </div>
                <div style={{ background: '#fff7ed', borderRadius: '8px', padding: '4px 10px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: orange }}>{lesson.lesson_slots?.slot_time?.slice(0, 5)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Progress */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: 0 }}>📈 Recent Progress</h3>
            <button onClick={() => router.push('/instructor/progress')} style={{ background: 'none', border: 'none', color: orange, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>View all →</button>
          </div>
          {recentProgress.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '28px', margin: '0 0 8px' }}>📈</p>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>No progress recorded yet</p>
            </div>
          ) : recentProgress.map((record, i) => {
            const avg = Number(avgRating(record))
            return (
              <div key={record.progress_id} style={{ padding: '10px 0', borderBottom: i < recentProgress.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{record.learner?.first_name} {record.learner?.surname}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{new Date(record.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: ratingColour(avg) }}>{avg}/5</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
