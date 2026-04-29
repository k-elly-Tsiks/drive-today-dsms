'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Instructor = {
  user_id: string
  first_name: string
  surname: string
  email: string
  phone_number?: string
  status: string
  role: string
  driving_classes_taught?: string | string[]
  created_at: string
  lessons_assigned?: number
}

// ── Skeleton Loader ────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = '16px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Design tokens
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const orange = '#e8731a'

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (data?.role !== 'admin') router.push('/login')
  }, [supabase, router])

  const loadInstructors = useCallback(async () => {
    setLoading(true)

    // 1. Fetch instructors
    const { data: instructorsData } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'instructor')
      .order('created_at', { ascending: false })

    // 2. Fetch all scheduled bookings to count active lessons per instructor
    const { data: bookingsData } = await supabase
      .from('lesson_bookings')
      .select('instructor_id')
      .eq('status', 'scheduled')

    // 3. Count them up
    const counts: Record<string, number> = {}
    if (bookingsData) {
      bookingsData.forEach(b => {
        if (b.instructor_id) {
          counts[b.instructor_id] = (counts[b.instructor_id] || 0) + 1
        }
      })
    }

    // 4. Merge the counts into the instructor data
    const mergedData = (instructorsData || []).map(inst => ({
      ...inst,
      lessons_assigned: counts[inst.user_id] || 0
    }))

    setInstructors(mergedData)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function init() {
      await checkAdmin()
      await loadInstructors()
    }
    init()
  }, [checkAdmin, loadInstructors])

  async function approveUser(userId: string) {
    setError('')
    const { error } = await supabase.from('users').update({ status: 'approved' }).eq('user_id', userId)
    if (error) { setError('Failed to approve instructor.'); return }

    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been approved. You can now log in to the system.',
      type: 'approval',
    })

    setSuccessMessage('Instructor approved successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadInstructors()
  }

  async function rejectUser(userId: string) {
    setError('')
    const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('user_id', userId)
    if (error) { setError('Failed to reject instructor.'); return }

    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been rejected. Please contact the administrator.',
      type: 'rejection',
    })

    setSuccessMessage('Instructor rejected.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadInstructors()
  }

  async function deactivateUser(userId: string) {
    setError('')
    const { error } = await supabase.from('users').update({ status: 'suspended' }).eq('user_id', userId)
    if (error) { setError('Failed to deactivate instructor.'); return }

    setSuccessMessage('Instructor deactivated.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadInstructors()
  }

  async function reactivateUser(userId: string) {
    setError('')
    const { error } = await supabase.from('users').update({ status: 'approved' }).eq('user_id', userId)
    if (error) { setError('Failed to reactivate instructor.'); return }

    setSuccessMessage('Instructor reactivated.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadInstructors()
  }

  // Filter and search
  const filteredInstructors = instructors.filter(i => {
    const matchesSearch =
      i.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.surname?.toLowerCase().includes(search.toLowerCase()) ||
      i.email?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || i.status === filter
    return matchesSearch && matchesFilter
  })

  function statusBadge(status: string) {
    const styles: Record<string, { background: string; color: string; border: string }> = {
      approved: { background: '#f0fdf4', color: '#16a34a', border: '#dcfce7' },
      pending: { background: '#fff7ed', color: '#ea580c', border: '#ffedd5' },
      rejected: { background: '#fef2f2', color: '#dc2626', border: '#fee2e2' },
      suspended: { background: '#f8fafc', color: '#475569', border: '#f1f5f9' },
    }
    const style = styles[status] || styles.pending
    return (
      <span style={{
        background: style.background, color: style.color, border: `1px solid ${style.border}`,
        padding: '4px 10px', borderRadius: '12px', fontSize: '11px',
        fontWeight: '700', textTransform: 'capitalize',
      }}>
        {status}
      </span>
    )
  }

  const handleCardClick = (label: string) => {
    if (label === 'Total Instructors') setFilter('all')
    else if (label === 'Approved') setFilter('approved')
    else if (label === 'Pending') setFilter('pending')
    else if (label === 'Rejected') setFilter('rejected')
    else if (label === 'Deactivated') setFilter('suspended')
  }

  // Helper to format classes properly whether they are string, array, or comma-separated
  const formatClasses = (classesRaw?: string | string[]) => {
    if (!classesRaw) return ['None specified']
    if (Array.isArray(classesRaw)) return classesRaw
    return classesRaw.split(',').map(c => c.trim()).filter(Boolean)
  }

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
      
      <div style={{ minHeight: '100%', padding: '0 0 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>🚗 Instructor Management</h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>Manage all instructor registrations and workloads</p>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
            ✅ {successMessage}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>
            ❌ {error}
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {loading ? (
             Array(5).fill(0).map((_, i) => (
               <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <Skeleton h="28px" w="40px" r="6px" />
                 <div style={{ marginTop: '8px' }}><Skeleton h="11px" w="70%" r="4px" /></div>
               </div>
             ))
          ) : (
            [
              { label: 'Total Instructors', value: instructors.length, colour: '#3b82f6' },
              { label: 'Approved', value: instructors.filter(i => i.status === 'approved').length, colour: '#10b981' },
              { label: 'Pending', value: instructors.filter(i => i.status === 'pending').length, colour: '#f59e0b' },
              { label: 'Rejected', value: instructors.filter(i => i.status === 'rejected').length, colour: '#ef4444' },
              { label: 'Deactivated', value: instructors.filter(i => i.status === 'suspended').length, colour: '#64748b' },
            ].map((stat, i) => (
              <div 
                key={i} 
                onClick={() => handleCardClick(stat.label)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
                style={{
                  background: 'white', borderRadius: '10px', padding: '20px 22px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${stat.colour}`,
                  cursor: 'pointer', transition: 'transform 0.15s',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>{stat.value}</p>
                <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '500' }}>{stat.label}</p>
              </div>
            ))
          )}
        </div>

        {/* Search and Filter */}
        <div style={{
          background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input
            type="text"
            placeholder="🔍 Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['all', 'approved', 'pending', 'rejected', 'suspended'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 14px', borderRadius: '20px',
                  border: filter === f ? 'none' : '1px solid #e2e8f0',
                  background: filter === f ? textDark : 'white',
                  color: filter === f ? 'white' : textMuted,
                  fontSize: '12px', fontWeight: filter === f ? '700' : '500',
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s',
                }}
              >
                {f === 'suspended' ? 'Deactivated' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Instructors Table */}
        <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {/* Using 2.5fr 2fr 1fr 1.5fr 2fr 2fr for better column spacing */}
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1.5fr 2fr 2fr', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Instructor', 'Email', 'Status', 'Active Lessons', 'Classes', 'Actions'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
            ))}
          </div>

          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1.5fr 2fr 2fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Skeleton w="36px" h="36px" r="50%" /><div><Skeleton w="100px" h="13px" r="4px" /><div style={{ marginTop: '5px' }}><Skeleton w="70px" h="10px" r="4px" /></div></div></div>
                <Skeleton w="120px" h="12px" r="4px" />
                <Skeleton w="60px" h="22px" r="12px" />
                <Skeleton w="40px" h="13px" r="4px" />
                <Skeleton w="80px" h="11px" r="4px" />
                <div style={{ display: 'flex', gap: '8px' }}><Skeleton w="60px" h="28px" r="6px" /></div>
              </div>
            ))
          ) : filteredInstructors.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🚗</p>
              <p style={{ color: textMuted, fontSize: '14px', fontWeight: '500' }}>No instructors found matching your criteria</p>
            </div>
          ) : (
            filteredInstructors.map((instructor) => (
              <div key={instructor.user_id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1.5fr 2fr 2fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: textDark, fontWeight: '700', fontSize: '13px', flexShrink: 0,
                  }}>
                    {instructor.first_name?.charAt(0)}{instructor.surname?.charAt(0)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: textDark }}>{instructor.first_name} {instructor.surname}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>{instructor.phone_number || 'No phone'}</p>
                  </div>
                </div>

                {/* Email */}
                <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>{instructor.email}</p>

                {/* Status */}
                <div>{statusBadge(instructor.status)}</div>

                {/* Active Lessons Assigned */}
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: orange }}>
                  {instructor.lessons_assigned || 0}
                </p>

                {/* Driving Classes - Formatted Nicely */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {formatClasses(instructor.driving_classes_taught).map((cls, idx) => (
                    <span key={idx} style={{
                      background: '#f1f5f9', color: textMuted, border: '1px solid #e2e8f0',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600'
                    }}>
                      {cls}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {instructor.status === 'pending' && (
                    <>
                      <button onClick={() => approveUser(instructor.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Approve</button>
                      <button onClick={() => rejectUser(instructor.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Reject</button>
                    </>
                  )}
                  {instructor.status === 'approved' && (
                    <button onClick={() => deactivateUser(instructor.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Deactivate</button>
                  )}
                  {instructor.status === 'suspended' && (
                    <button onClick={() => reactivateUser(instructor.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Reactivate</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </>
  )
}
