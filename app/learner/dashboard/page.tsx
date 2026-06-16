'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Calendar, CheckCircle, Clock, BookOpen, AlertCircle, Sparkles, HelpCircle, Star, ArrowRight } from 'lucide-react'

type Lesson = {
  booking_id: string
  status: string
  lesson_slots?: { slot_date: string; slot_time: string }
  instructor?: { first_name: string; surname: string }
}

type ProgressRecord = {
  steering_rating: number
  parking_rating: number
  reversing_rating: number
  road_awareness_rating: number
}

const supabase = createClient()

export default function LearnerDashboard() {
  // NOTE: Learner layout already provides the shared sidebar/topbar and dark-mode toggle.
  // This page focuses only on inner content; styling here can be updated later for perfect visual parity.
  const [learnerName, setLearnerName] = useState('')
  const [slotsAllocated, setSlotsAllocated] = useState(0)
  const [scheduledCount, setScheduledCount] = useState(0)
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([])
  const [progressRatings, setProgressRatings] = useState<ProgressRecord[]>([])
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const router = useRouter()
  const orange = '#ff5a00'

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

  const theme = {
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    hoverBg: isDarkMode ? '#2d3545' : '#f8fafc',
    shimmerBg: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const today = new Date().toISOString().split('T')[0]

    // Fetch user details, bookings, progress tracking, payments, and quotations
    const [userRes, bookingsRes, progressRes, paymentsRes, quotationsRes] = await Promise.all([
      supabase.from('users').select('*').eq('user_id', user.id).single(),
      supabase.from('lesson_bookings')
        .select(`
          booking_id, status, 
          lesson_slots (slot_date, slot_time), 
          instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname)
        `)
        .eq('learner_id', user.id),
      supabase.from('progress_tracking')
        .select('steering_rating, parking_rating, reversing_rating, road_awareness_rating')
        .eq('learner_id', user.id),
      supabase.from('payments').select('amount').eq('learner_id', user.id),
      supabase.from('quotations').select('total_amount').eq('learner_id', user.id),
    ])

    if (userRes.data) {
      setLearnerName(userRes.data.first_name)
      setSlotsAllocated(userRes.data.slots_allocated || 0)
    }

    const bookingsList = bookingsRes.data || []
    setScheduledCount(bookingsList.filter(b => b.status === 'scheduled').length)

    // Filter upcoming scheduled lessons
    const filteredUpcoming = bookingsList
      .filter(b => b.status === 'scheduled' && b.lesson_slots && b.lesson_slots.slot_date >= today)
      .sort((a, b) => {
        const dateA = `${a.lesson_slots!.slot_date}T${a.lesson_slots!.slot_time}`
        const dateB = `${b.lesson_slots!.slot_date}T${b.lesson_slots!.slot_time}`
        return dateA.localeCompare(dateB)
      })
      .slice(0, 3)
    setUpcomingLessons(filteredUpcoming)

    setProgressRatings(progressRes.data || [])

    // Calculate outstanding financial balance
    const payments = paymentsRes.data || []
    const quotations = quotationsRes.data || []
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalQuoted = quotations.reduce((sum, q) => sum + Number(q.total_amount), 0)
    setOutstandingBalance(Math.max(0, totalQuoted - totalPaid))

    setLoading(false)
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Derive stats
  const remainingSlots = Math.max(0, slotsAllocated - scheduledCount)
  const nextLesson = upcomingLessons[0]

  const avgProgress = () => {
    if (progressRatings.length === 0) return null
    let total = 0
    let count = 0
    progressRatings.forEach(r => {
      const vals = [r.steering_rating, r.parking_rating, r.reversing_rating, r.road_awareness_rating]
      vals.forEach(v => {
        if (v !== undefined && v !== null) {
          total += v
          count++
        }
      })
    })
    return count > 0 ? (total / count).toFixed(1) : null
  }

  const overallAvg = avgProgress()

  // Mini helper for average scores
  const getSkillAverage = (key: keyof ProgressRecord) => {
    if (progressRatings.length === 0) return 0
    const sum = progressRatings.reduce((s, r) => s + (Number(r[key]) || 0), 0)
    return (sum / progressRatings.length).toFixed(1)
  }

  const skills = [
    { label: 'Steering', score: getSkillAverage('steering_rating') },
    { label: 'Parking', score: getSkillAverage('parking_rating') },
    { label: 'Reversing', score: getSkillAverage('reversing_rating') },
    { label: 'Road Awareness', score: getSkillAverage('road_awareness_rating') },
  ]

  const StatCard = ({ label, value, subtext, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      style={{
        background: theme.cardBg,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${theme.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = orange
          e.currentTarget.style.boxShadow = '0 12px 20px -8px rgba(255,90,0,0.15)'
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.borderColor = theme.border
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      <div>
        <p style={{ margin: '0 0 6px', color: theme.textMuted, fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: theme.textMain, letterSpacing: '-0.5px' }}>{value}</p>
        <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>{subtext}</p>
      </div>
      <div style={{
        background: isDarkMode ? '#1e2433' : '#f8fafc',
        padding: '12px',
        borderRadius: '14px',
        color: color || theme.textMuted,
        border: `1px solid ${theme.border}`,
      }}>
        <Icon size={22} />
      </div>
    </div>
  )

  const SkeletonLoader = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      {/* Title block */}
      <div style={{ width: '280px', height: '32px', borderRadius: '8px', background: theme.shimmerBg, animation: 'shimmer 1.5s infinite linear', backgroundImage: `linear-gradient(90deg, ${theme.shimmerBg} 25%, ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 37%, ${theme.shimmerBg} 63%)`, backgroundSize: '400% 100%' }} />
      <div style={{ width: '400px', height: '18px', borderRadius: '6px', background: theme.shimmerBg, animation: 'shimmer 1.5s infinite linear', backgroundImage: `linear-gradient(90deg, ${theme.shimmerBg} 25%, ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 37%, ${theme.shimmerBg} 63%)`, backgroundSize: '400% 100%' }} />

      {/* Cards block */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} style={{ height: '128px', borderRadius: '16px', background: theme.shimmerBg, border: `1px solid ${theme.border}`, animation: 'shimmer 1.5s infinite linear', backgroundImage: `linear-gradient(90deg, ${theme.shimmerBg} 25%, ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 37%, ${theme.shimmerBg} 63%)`, backgroundSize: '400% 100%' }} />
        ))}
      </div>

      {/* Grid panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        <div style={{ height: '300px', borderRadius: '16px', background: theme.shimmerBg, border: `1px solid ${theme.border}`, animation: 'shimmer 1.5s infinite linear', backgroundImage: `linear-gradient(90deg, ${theme.shimmerBg} 25%, ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 37%, ${theme.shimmerBg} 63%)`, backgroundSize: '400% 100%' }} />
        <div style={{ height: '300px', borderRadius: '16px', background: theme.shimmerBg, border: `1px solid ${theme.border}`, animation: 'shimmer 1.5s infinite linear', backgroundImage: `linear-gradient(90deg, ${theme.shimmerBg} 25%, ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 37%, ${theme.shimmerBg} 63%)`, backgroundSize: '400% 100%' }} />
      </div>
    </div>
  )

  if (loading) return <SkeletonLoader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* ── Welcome Banner ── */}
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: '700', color: theme.textMain, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          Welcome back, {learnerName || 'Learner'}! 👋
        </h2>
        <p style={{ color: theme.textMuted, fontSize: '15px', margin: 0, fontWeight: '500' }}>
          Track your progress, manage scheduled lessons, and access learning guides.
        </p>
      </div>

      {/* ── Stat Cards Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <StatCard 
          label="Remaining Lessons" 
          value={`${remainingSlots} / ${slotsAllocated}`} 
          subtext="Available booking slots" 
          icon={Calendar} 
          color="#ff5a00"
          onClick={() => router.push('/learner/lessons')}
        />
        <StatCard 
          label="Overall Rating" 
          value={overallAvg ? `${overallAvg} / 5.0` : 'No reviews'} 
          subtext="Instructor feedback score" 
          icon={Star} 
          color="#eab308"
          onClick={() => router.push('/learner/progress')}
        />
        <StatCard 
          label="Outstanding Balance" 
          value={`$${outstandingBalance.toFixed(2)}`} 
          subtext={outstandingBalance > 0 ? "Pending payment" : "Fully paid up"} 
          icon={AlertCircle} 
          color={outstandingBalance > 0 ? '#ef4444' : '#10b981'}
          onClick={() => router.push('/learner/payments')}
        />
        <StatCard 
          label="Next Scheduled Lesson" 
          value={nextLesson?.lesson_slots ? new Date(nextLesson.lesson_slots.slot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'None'} 
          subtext={nextLesson?.lesson_slots ? nextLesson.lesson_slots.slot_time.slice(0, 5) : 'Book a new session'} 
          icon={Clock} 
          color="#3b82f6"
          onClick={() => router.push('/learner/lessons')}
        />
      </div>

      {/* ── Two Column Details Area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Upcoming Lessons Panel */}
        <div style={{ background: theme.cardBg, borderRadius: '16px', border: `1px solid ${theme.border}`, padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color={orange} />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: theme.textMain, margin: 0 }}>Upcoming Schedule</h3>
            </div>
            <button 
              onClick={() => router.push('/learner/lessons')} 
              style={{ background: 'transparent', border: 'none', color: orange, fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Book lessons <ArrowRight size={14} />
            </button>
          </div>

          {upcomingLessons.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', margin: '0 0 10px' }}>📅</p>
              <p style={{ color: theme.textMain, fontWeight: '600', fontSize: '14px', margin: '0 0 4px' }}>No scheduled lessons</p>
              <p style={{ color: theme.textMuted, fontSize: '12px', margin: 0 }}>Book dynamic sessions to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingLessons.map(l => (
                <div 
                  key={l.booking_id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: isDarkMode ? '#1e2433' : '#fafafa',
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '14px', color: theme.textMain }}>
                      {l.instructor ? `${l.instructor.first_name} ${l.instructor.surname}` : 'Unassigned Instructor'}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>
                      {l.lesson_slots ? new Date(l.lesson_slots.slot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: orange, background: isDarkMode ? 'rgba(255,90,0,0.1)' : '#fff7ed', padding: '4px 10px', borderRadius: '20px' }}>
                      {l.lesson_slots ? l.lesson_slots.slot_time.slice(0, 5) : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skill Progress Overview */}
        <div style={{ background: theme.cardBg, borderRadius: '16px', border: `1px solid ${theme.border}`, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={18} color="#eab308" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: theme.textMain, margin: 0 }}>Skill Development</h3>
            </div>
            <button 
              onClick={() => router.push('/learner/progress')}
              style={{ background: 'transparent', border: 'none', color: orange, fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Full reports <ArrowRight size={14} />
            </button>
          </div>

          {progressRatings.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', margin: '0 0 10px' }}>📈</p>
              <p style={{ color: theme.textMain, fontWeight: '600', fontSize: '14px', margin: '0 0 4px' }}>No skill ratings yet</p>
              <p style={{ color: theme.textMuted, fontSize: '12px', margin: 0 }}>Ratings will appear after your instructor assesses a lesson.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {skills.map((skill, index) => {
                const scoreNum = Number(skill.score)
                const percent = (scoreNum / 5) * 100
                return (
                  <div key={index}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '600', color: theme.textMain }}>{skill.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: orange }}>{scoreNum > 0 ? `${scoreNum} / 5.0` : '—'}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: isDarkMode ? '#1e2433' : '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: `linear-gradient(90deg, ${orange}, #ff7a00)`, borderRadius: '4px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Quick Learning & Study Actions ── */}
      <div style={{ background: `linear-gradient(135deg, #0b1329, #1a2544)`, borderRadius: '16px', padding: '28px', color: 'white', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={18} color={orange} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#ffffff' }}>Prepare for your Driving Tests</h3>
          </div>
          <p style={{ margin: 0, color: '#a0aec0', fontSize: '14px' }}>
            Read validated study guides and attempt practice quizzes to secure your driving credentials.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => router.push('/learner/materials')}
            style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          >
            Study Guides
          </button>
          <button 
            onClick={() => router.push('/learner/practice')}
            style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', background: orange, color: 'white', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(255,90,0,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            Practice Exam
          </button>
        </div>
      </div>

    </div>
  )
}
