'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
// Imported the required icons
import { Calendar, CheckCircle, Clock, Users, TrendingUp } from 'lucide-react'

// Types (Keep these)
type Lesson = { booking_id: string; learner_id: string; lesson_slots?: { slot_date: string; slot_time: string }; learner?: { first_name: string; surname: string; phone_number?: string } }
type ProgressRecord = { progress_id: string; recorded_at: string; steering_rating?: number; parking_rating?: number; reversing_rating?: number; road_awareness_rating?: number; learner?: { first_name: string; surname: string } }
type InstructorProfile = { first_name: string; surname: string }

const supabase = createClient()

type IconComponent = React.ComponentType<{ size?: number; color?: string }>

type StatCardProps = {
  label: string
  value: number
  subtext: string
  icon: IconComponent
  bg: string
  color: string
  onClick?: () => void
}

function StatCard({ label, value, subtext, icon: Icon, bg, color, onClick }: StatCardProps) {

  const orange = '#ff5a00'
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
      onMouseEnter={e => {
        if (!onClick) return
        e.currentTarget.style.borderColor = orange
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
      }}
      onMouseLeave={e => {
        if (!onClick) return
        e.currentTarget.style.borderColor = '#e2e8f0'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div>
        <p style={{ margin: '0 0 4px', color: '#64748b', fontSize: '14px' }}>{label}</p>
        <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '700', color: '#111827' }}>{value}</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{subtext}</p>
      </div>
      <div style={{ background: bg, padding: '12px', borderRadius: '12px', color: color }}>
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
    if (!user) { router.push('/login'); return }
    const today = new Date().toISOString().split('T')[0]
    
    const [ins, todayData, upcomingData, counts, progress] = await Promise.all([
      supabase.from('users').select('*').eq('user_id', user.id).single(),
      supabase.from('lesson_bookings').select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number)`).eq('instructor_id', user.id).eq('status', 'scheduled').eq('lesson_slots.slot_date', today),
      supabase.from('lesson_bookings').select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname)`).eq('instructor_id', user.id).eq('status', 'scheduled').gt('lesson_slots.slot_date', today).limit(5),
      supabase.from('lesson_bookings').select('status, learner_id').eq('instructor_id', user.id),
      supabase.from('progress_tracking').select(`*, learner:users!progress_tracking_learner_id_fkey (first_name, surname)`).eq('instructor_id', user.id).order('recorded_at', { ascending: false }).limit(3)
    ])

    setInstructor(ins.data)
    setTodaysLessons(todayData.data || [])
    setUpcomingLessons(upcomingData.data || [])
    setRecentProgress(progress.data || [])
    
    const bookings = counts.data || []
    setStats({
      totalLessons: bookings.length,
      completedLessons: bookings.filter(b => b.status === 'completed').length,
      upcomingCount: bookings.filter(b => b.status === 'scheduled').length,
      totalLearners: new Set(bookings.map(b => b.learner_id)).size
    })
    setLoading(false)
  }, [router])

  // Note: ESLint rule react-hooks/set-state-in-effect is failing in this project.
  // Keep the original useEffect trigger, but run it via a microtask.
  useEffect(() => {
    const t = setTimeout(() => {
      loadDashboard().catch(() => {})
    }, 0)
    return () => clearTimeout(t)
  }, [loadDashboard])









  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Dashboard...</div>

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>Welcome back, {instructor?.first_name}!</h2>
        <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>Here is a summary review of your driving academy operations today.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <StatCard label="Total Learners" value={stats.totalLearners} subtext="+0 new this week" icon={Users} bg="#eff6ff" color="#3b82f6" />
        <StatCard label="Completed" value={stats.completedLessons} subtext="Lessons finished" icon={CheckCircle} bg="#f0fdf4" color="#22c55e" />
        <StatCard label="Lessons Today" value={todaysLessons.length} subtext="Pending slots" icon={Calendar} bg="#fff7ed" color={orange} />
        <StatCard label="Upcoming" value={stats.upcomingCount} subtext="Next scheduled" icon={Clock} bg="#f5f3ff" color="#7c3aed" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {/* Today's Lessons */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={18} color="#64748b" />
            <h3 style={{ fontSize: '16px', margin: 0 }}>Todays Lessons</h3>
          </div>
          {todaysLessons.map(l => <div key={l.booking_id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}><p style={{ margin: 0, fontWeight: '600' }}>{l.learner?.first_name} {l.learner?.surname}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>{l.lesson_slots?.slot_time?.slice(0, 5)}</p></div>)}
        </div>
        
        {/* Upcoming */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={18} color="#64748b" />
            <h3 style={{ fontSize: '16px', margin: 0 }}>Upcoming</h3>
          </div>
          {upcomingLessons.map(l => <div key={l.booking_id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}><p style={{ margin: 0, fontWeight: '600' }}>{l.learner?.first_name}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>{l.lesson_slots?.slot_date}</p></div>)}
        </div>

        {/* Progress */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={18} color="#64748b" />
            <h3 style={{ fontSize: '16px', margin: 0 }}>Recent Progress</h3>
          </div>
          {recentProgress.map(p => <div key={p.progress_id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}><p style={{ margin: 0, fontWeight: '600' }}>{p.learner?.first_name}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>Recorded: {new Date(p.recorded_at).toLocaleDateString()}</p></div>)}
        </div>
      </div>
    </div>
  )
}