'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Calendar, CheckCircle, Clock, Users, TrendingUp } from 'lucide-react'
import { DTSkeleton } from '@/app/_components/ui/dt-skeleton'



type Lesson = {
  booking_id: string
  learner_id: string
  lesson_slots?: { slot_date: string; slot_time: string }
  learner?: { first_name: string; surname: string; phone_number?: string }
}

type ProgressRecord = {
  progress_id: string
  recorded_at: string
  learner?: { first_name: string; surname: string }
}

type InstructorProfile = { first_name: string; surname: string }

const supabase = createClient()

function StatCard({
  onClick,
  label,
  value,
  subtext,
  icon: Icon,
  bg,
  color,
}: {
  onClick: () => void
  label: string
  value: number
  subtext: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  bg: string
  color: string
}) {
  return (
    <div
      className="instructor-card"
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        border: '1px solid #e2e8f0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#ff5a00'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e2e8f0'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div>
        <p style={{ margin: '0 0 4px', color: '#64748b', fontSize: 14 }}>{label}</p>
        <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#111827' }}>{value}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{subtext}</p>
      </div>
      <div style={{ background: bg, padding: 12, borderRadius: 12, color }}>
        <Icon size={24} />
      </div>
    </div>
  )
}

export default function InstructorDashboard() {
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null)
  const [todaysLessons, setTodaysLessons] = useState<Lesson[]>([])
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([])
  const [recentProgress, setRecentProgress] = useState<ProgressRecord[]>([])
  const [stats, setStats] = useState({ totalLessons: 0, completedLessons: 0, upcomingCount: 0, totalLearners: 0 })
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const orange = '#ff5a00'

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    const [ins, todayData, upcomingData, totalCount, completedCount, scheduledCount, learnerIds, progress] = await Promise.all([
      supabase.from('users').select('first_name, surname').eq('user_id', user.id).single(),
      supabase
        .from('lesson_bookings')
        .select(`booking_id, learner_id, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number)`)
        .eq('instructor_id', user.id)
        .eq('status', 'scheduled')
        .eq('lesson_slots.slot_date', today),
      supabase
        .from('lesson_bookings')
        .select(`booking_id, learner_id, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname)`)
        .eq('instructor_id', user.id)
        .eq('status', 'scheduled')
        .gt('lesson_slots.slot_date', today)
        .order('created_at', { ascending: true })
        .limit(5),
      supabase.from('lesson_bookings').select('booking_id', { count: 'exact', head: true }).eq('instructor_id', user.id),
      supabase.from('lesson_bookings').select('booking_id', { count: 'exact', head: true }).eq('instructor_id', user.id).eq('status', 'completed'),
      supabase.from('lesson_bookings').select('booking_id', { count: 'exact', head: true }).eq('instructor_id', user.id).eq('status', 'scheduled'),
      supabase.from('lesson_bookings').select('learner_id').eq('instructor_id', user.id),
      supabase
        .from('progress_tracking')
        .select(`progress_id, recorded_at, learner:users!progress_tracking_learner_id_fkey (first_name, surname)`)
        .eq('instructor_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(3),
    ])

    setInstructor(ins.data)
    setTodaysLessons(todayData.data || [])
    setUpcomingLessons(upcomingData.data || [])
    setRecentProgress(progress.data || [])

    setStats({
      totalLessons: totalCount.count ?? 0,
      completedLessons: completedCount.count ?? 0,
      upcomingCount: scheduledCount.count ?? 0,
      totalLearners: new Set((learnerIds.data || []).map((booking: { learner_id: string }) => booking.learner_id)).size,

    })
    setLoading(false)
  }, [router])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!cancelled) await loadDashboard()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [loadDashboard])

  if (loading) {
    return (
      <div className="instructor-page instructor-dashboard">
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div className="instructor-page-header" style={{ marginBottom: 32 }}>
          <DTSkeleton w="260px" h="32px" r="8px" />
          <div style={{ marginTop: 10 }}>
            <DTSkeleton w="420px" h="16px" r="5px" />
          </div>
        </div>

        <div className="instructor-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="instructor-card"
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 24,
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <DTSkeleton w="90px" h="14px" />
                <div style={{ marginTop: 10 }}>
                  <DTSkeleton w="58px" h="30px" r="7px" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <DTSkeleton w="120px" h="12px" r="4px" />
                </div>
              </div>
              <DTSkeleton w="48px" h="48px" r="12px" />
            </div>
          ))}
        </div>

        <div className="instructor-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="instructor-card" style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
              <DTSkeleton w="150px" h="18px" r="5px" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <DTSkeleton w="60%" h="14px" r="4px" />
                  <div style={{ marginTop: 8 }}>
                    <DTSkeleton w="34%" h="12px" r="4px" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="instructor-page instructor-dashboard">
      <div className="instructor-page-header" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Welcome back, {instructor?.first_name}!</h2>
        <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>Here is a summary review of your driving academy operations today.</p>
      </div>

      <div className="instructor-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
        <StatCard
          label="Total Learners"
          value={stats.totalLearners}
          subtext="+0 new this week"
          icon={Users}
          bg="#eff6ff"
          color="#3b82f6"
          onClick={() => router.push('/instructor/lessons')}
        />
        <StatCard
          label="Completed"
          value={stats.completedLessons}
          subtext="Lessons finished"
          icon={CheckCircle}
          bg="#f0fdf4"
          color="#22c55e"
          onClick={() => router.push('/instructor/progress')}
        />
        <StatCard
          label="Lessons Today"
          value={todaysLessons.length}
          subtext="Pending slots"
          icon={Calendar}
          bg="#fff7ed"
          color={orange}
          onClick={() => router.push('/instructor/lessons')}
        />
        <StatCard
          label="Upcoming"
          value={stats.upcomingCount}
          subtext="Next scheduled"
          icon={Clock}
          bg="#f5f3ff"
          color="#7c3aed"
          onClick={() => router.push('/instructor/lessons')}
        />
      </div>

      <div className="instructor-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div className="instructor-card" style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Calendar size={18} color="#64748b" />
            <h3 style={{ fontSize: 16, margin: 0 }}>Todays Lessons</h3>
          </div>
          {todaysLessons.map(l => (
            <div key={l.booking_id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{l.learner?.first_name} {l.learner?.surname}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{l.lesson_slots?.slot_time?.slice(0, 5)}</p>
            </div>
          ))}
        </div>

        <div className="instructor-card" style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Clock size={18} color="#64748b" />
            <h3 style={{ fontSize: 16, margin: 0 }}>Upcoming</h3>
          </div>
          {upcomingLessons.map(l => (
            <div key={l.booking_id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{l.learner?.first_name}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{l.lesson_slots?.slot_date}</p>
            </div>
          ))}
        </div>

        <div className="instructor-card" style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={18} color="#64748b" />
            <h3 style={{ fontSize: 16, margin: 0 }}>Recent Progress</h3>
          </div>
          {recentProgress.map(p => (
            <div key={p.progress_id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{p.learner?.first_name}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Recorded: {new Date(p.recorded_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
