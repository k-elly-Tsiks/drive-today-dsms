'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

type Instructor = {
  user_id: string
  first_name: string
  surname: string
  email: string
  phone_number?: string
  status: string
  role: string
  driving_classes_taught?: string
  created_at: string
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


  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

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

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'instructor')
    .order('created_at', { ascending: false })

  setInstructors(data || [])
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
    const { error } = await supabase
      .from('users')
      .update({ status: 'approved' })
      .eq('user_id', userId)

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
    const { error } = await supabase
      .from('users')
      .update({ status: 'rejected' })
      .eq('user_id', userId)

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
    const { error } = await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('user_id', userId)

    if (error) { setError('Failed to deactivate instructor.'); return }

    setSuccessMessage('Instructor deactivated.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadInstructors()
  }

  async function reactivateUser(userId: string) {
    setError('')
    const { error } = await supabase
      .from('users')
      .update({ status: 'approved' })
      .eq('user_id', userId)

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
    const styles: Record<string, { background: string; color: string }> = {
      approved: { background: '#d1fae5', color: '#065f46' },
      pending: { background: '#fef3c7', color: '#92400e' },
      rejected: { background: '#fee2e2', color: '#991b1b' },
      suspended: { background: '#f3f4f6', color: '#374151' },
    }
    return (
      <span style={{
        ...styles[status] || styles.pending,
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'capitalize' as const,
      }}>
        {status}
      </span>
    )
  }

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
        <p style={{ color: blue, fontWeight: '600' }}>Loading Instructors...</p>
      </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            🚗 Instructor Management
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Manage all instructor registrations and accounts
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
          ← Back to Dashboard
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div style={{
          background: '#d1fae5', border: '1px solid #6ee7b7',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '16px', color: '#065f46',
          fontSize: '13px', fontWeight: '600',
        }}>
          ✅ {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '16px', color: '#991b1b',
          fontSize: '13px', fontWeight: '600',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total Instructors', value: instructors.length, colour: blue },
          { label: 'Approved', value: instructors.filter(i => i.status === 'approved').length, colour: '#059669' },
          { label: 'Pending', value: instructors.filter(i => i.status === 'pending').length, colour: '#d97706' },
          { label: 'Rejected', value: instructors.filter(i => i.status === 'rejected').length, colour: '#dc2626' },
          { label: 'Deactivated', value: instructors.filter(i => i.status === 'suspended').length, colour: '#6b7280' },
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
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '16px 20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '12px', alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="🔍 Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px',
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'approved', 'pending', 'rejected', 'suspended'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                border: filter === f ? 'none' : '1px solid #e5e7eb',
                background: filter === f
                  ? `linear-gradient(135deg, ${blue}, ${orange})`
                  : 'white',
                color: filter === f ? 'white' : '#6b7280',
                fontSize: '12px', fontWeight: filter === f ? '700' : '400',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Instructors Table */}
      <div style={{
        background: 'white', borderRadius: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr 2fr',
          padding: '12px 20px',
          background: lightBlue,
          borderBottom: '1px solid #e5e7eb',
        }}>
          {['Instructor', 'Email', 'Status', 'Classes', 'Registered', 'Actions'].map((h, i) => (
            <p key={i} style={{
              margin: 0, fontSize: '11px',
              fontWeight: '700', color: blue,
              textTransform: 'uppercase',
            }}>
              {h}
            </p>
          ))}
        </div>

        {/* Table Rows */}
        {filteredInstructors.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🚗</p>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>No instructors found</p>
          </div>
        ) : (
          filteredInstructors.map((instructor, index) => (
            <div
              key={instructor.user_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr 2fr',
                padding: '14px 20px',
                borderBottom: '1px solid #f3f4f6',
                background: index % 2 === 0 ? 'white' : '#fafafa',
                alignItems: 'center',
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: lightBlue, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: blue, fontWeight: '700', fontSize: '13px',
                  flexShrink: 0,
                }}>
                  {instructor.first_name?.charAt(0)}{instructor.surname?.charAt(0)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {instructor.first_name} {instructor.surname}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {instructor.phone_number}
                  </p>
                </div>
              </div>

              {/* Email */}
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {instructor.email}
              </p>

              {/* Status */}
              <div>{statusBadge(instructor.status)}</div>

              {/* Driving Classes */}
              <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>
                {instructor.driving_classes_taught || 'Not specified'}
              </p>

              {/* Date */}
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                {new Date(instructor.created_at).toLocaleDateString()}
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {instructor.status === 'pending' && (
                  <>
                    <button
                      onClick={() => approveUser(instructor.user_id)}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        border: 'none', background: '#d1fae5',
                        color: '#065f46', fontSize: '11px',
                        fontWeight: '700', cursor: 'pointer',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectUser(instructor.user_id)}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        border: 'none', background: '#fee2e2',
                        color: '#991b1b', fontSize: '11px',
                        fontWeight: '700', cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {instructor.status === 'approved' && (
                  <button
                    onClick={() => deactivateUser(instructor.user_id)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: 'none', background: '#f3f4f6',
                      color: '#374151', fontSize: '11px',
                      fontWeight: '700', cursor: 'pointer',
                    }}
                  >
                    Deactivate
                  </button>
                )}
                {instructor.status === 'suspended' && (
                  <button
                    onClick={() => reactivateUser(instructor.user_id)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: 'none', background: '#d1fae5',
                      color: '#065f46', fontSize: '11px',
                      fontWeight: '700', cursor: 'pointer',
                    }}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}