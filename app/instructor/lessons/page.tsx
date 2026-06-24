'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Layers, CalendarCheck, Users, History, CheckCircle, AlertCircle, CheckCircle2, Clock, Users2, Phone, Mail, CalendarDays, AlertTriangle, XCircle } from 'lucide-react'


type Booking = {
  booking_id: string
  status: string
  learner_id: string
  slot_id: string
  instructor_id?: string
  cancellation_reason?: string
  lesson_slots?: { slot_date: string; slot_time: string }
  learner?: { first_name: string; surname: string; phone_number?: string; email?: string }
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

export default function InstructorLessonsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Today') // Default tab
  const [search, setSearch] = useState('')
  const router = useRouter()

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('lesson_bookings')
      .select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number, email)`)
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })

    setBookings(data || [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!cancelled) await loadBookings()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [loadBookings])


  // Logic for filtered lists
  const today = new Date().toISOString().split('T')[0]
  const todayBookings = bookings.filter(b => b.status === 'scheduled' && b.lesson_slots?.slot_date === today)
  const upcomingBookings = bookings.filter(b => b.status === 'scheduled' && b.lesson_slots?.slot_date && b.lesson_slots.slot_date > today)
  const pastBookings = bookings.filter(b => b.status !== 'scheduled' || (b.lesson_slots?.slot_date && b.lesson_slots.slot_date < today))

  // Determine which list to use based on the active tab
  const getTabBookings = () => {
    if (activeTab === 'Today') return todayBookings
    if (activeTab === 'Upcoming') return upcomingBookings
    return pastBookings
  }

  // Apply search filtering on top of tab filtering
  const displayBookings = getTabBookings().filter(b => {
    const fullName = `${b.learner?.first_name || ''} ${b.learner?.surname || ''}`.toLowerCase()
    return fullName.includes(search.toLowerCase())
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', padding: '24px', fontFamily: 'sans-serif' }}>
      <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: '0 0 8px' }}>Lessons Management</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Configure scheduling availability and manage active bookings</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div>
              <Skeleton w="70px" h="13px" r="4px" />
              <div style={{ marginTop: '10px' }}><Skeleton w="42px" h="26px" r="5px" /></div>
            </div>
            <Skeleton w="40px" h="40px" r="10px" />
          </div>
        )) : [
          { label: "Today's", value: todayBookings.length, icon: CalendarCheck, color: '#1e3a8a' },
          { label: 'Upcoming', value: upcomingBookings.length, icon: Layers, color: '#f97316' },
          { label: 'Completed', value: pastBookings.filter(b => b.status === 'completed').length, icon: CheckCircle2, color: '#059669' },
          { label: 'Cancelled', value: pastBookings.filter(b => b.status === 'cancelled').length, icon: AlertCircle, color: '#dc2626' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6b7280' }}>{stat.label}</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>{stat.value}</p>
            </div>
            <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '10px' }}><stat.icon size={20} color={stat.color} /></div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '12px', border: '1px solid #e5e7eb', width: 'fit-content' }}>
          {['Today', 'Upcoming', 'History'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              style={{ 
                padding: '10px 20px', borderRadius: '8px', border: 'none', 
                background: activeTab === tab ? 'white' : 'transparent', 
                color: activeTab === tab ? '#f97316' : '#4b5563', 
                fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search learner..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
      </div>

      {/* List Display Area */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fafafa' }}>
                <div>
                  <Skeleton w="160px" h="16px" r="4px" />
                  <div style={{ marginTop: '8px' }}><Skeleton w="210px" h="13px" r="4px" /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '7px' }}>
                  <Skeleton w="96px" h="14px" r="4px" />
                  <Skeleton w="48px" h="12px" r="4px" />
                  <Skeleton w="78px" h="22px" r="20px" />
                </div>
              </div>
            ))}
          </div>
        ) : displayBookings.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>No lessons found for {activeTab}.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {displayBookings.map((b) => (
              <div 
                key={b.booking_id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '12px',
                  background: '#fafafa'
                }}
              >
                {/* Learner Info Column */}
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                    {b.learner?.first_name || 'N/A'} {b.learner?.surname || ''}
                  </h3>
                  <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>
                    {b.learner?.phone_number || b.learner?.email || 'No contact info'}
                  </p>
                </div>

                {/* Date & Status Info Column */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {b.lesson_slots?.slot_date ? new Date(b.lesson_slots.slot_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Date'}
                  </p>
                  <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#4b5563' }}>
                    {b.lesson_slots?.slot_time ? b.lesson_slots.slot_time.slice(0, 5) : 'No Time'}
                  </p>
                  <span 
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      padding: '4px 8px', 
                      borderRadius: '20px',
                      textTransform: 'uppercase',
                      background: b.status === 'scheduled' ? '#e0f2fe' : b.status === 'completed' ? '#dcfce7' : '#fee2e2',
                      color: b.status === 'scheduled' ? '#0369a1' : b.status === 'completed' ? '#15803d' : '#b91c1c'
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
