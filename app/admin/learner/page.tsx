'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Learner = {
  user_id: string
  first_name: string
  surname: string
  email: string
  phone_number?: string
  status: 'approved' | 'pending' | 'rejected' | 'suspended'
  role: string
  slots_allocated?: number
  created_at: string
}
export default function LearnersPage() {
 const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null)
  const [slotsToAssign, setSlotsToAssign] = useState('')
  const [assigningSlots, setAssigningSlots] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

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


  const loadLearners = useCallback(async () => {
  setLoading(true)
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'learner')
    .order('created_at', { ascending: false })

  setLearners(data || [])
  setLoading(false)
}, [supabase])


   useEffect(() => {
  async function init() {
    await checkAdmin()
    await loadLearners()
  }

  init()
}, [checkAdmin, loadLearners])


  async function approveUser(userId: string) {
    setError('')
    const { error } = await supabase
      .from('users')
      .update({ status: 'approved' })
      .eq('user_id', userId)

    if (error) { setError('Failed to approve user.'); return }

    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been approved. You can now log in to the system.',
      type: 'approval',
    })

    setSuccessMessage('Learner approved successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadLearners()
  }

  async function rejectUser(userId: string) {
    setError('')
    const { error } = await supabase
      .from('users')
      .update({ status: 'rejected' })
      .eq('user_id', userId)

    if (error) { setError('Failed to reject user.'); return }

    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been rejected. Please contact the administrator.',
      type: 'rejection',
    })

    setSuccessMessage('Learner rejected.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadLearners()
  }

  async function suspendUser(userId: string) {
    setError('')
    const { error } = await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('user_id', userId)

    if (error) { setError('Failed to suspend user.'); return }

    setSuccessMessage('Learner suspended.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadLearners()
  }
  async function assignSlots() {
    if (!slotsToAssign || parseInt(slotsToAssign) <= 0) {
      setError('Please enter a valid number of slots.')
      return
    }

    setAssigningSlots(true)
    setError('')

    if (!selectedLearner) return
    const { error } = await supabase
      .from('users')
      .update({ slots_allocated: parseInt(slotsToAssign) })
      .eq('user_id', selectedLearner.user_id)

    if (error) {
      setError('Failed to assign slots. Make sure the slots_allocated column exists in your users table.')
      setAssigningSlots(false)
      return
    }

    await supabase.from('notifications').insert({
      recipient_id: selectedLearner.user_id,
      message: `The administrator has allocated ${slotsToAssign} lesson slot(s) to your account. You can now select your lessons.`,
      type: 'slot_allocation',
    })

    setSuccessMessage(`${slotsToAssign} slots assigned to ${selectedLearner.first_name} successfully.`)
    setTimeout(() => setSuccessMessage(''), 3000)
    setSelectedLearner(null)
    setSlotsToAssign('')
    setAssigningSlots(false)
    loadLearners()
  }

  // Filter and search
  const filteredLearners = learners.filter((l: Learner) => {

    const matchesSearch =
      l.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.surname?.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || l.status === filter
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
        textTransform: 'capitalize',
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
        <p style={{ color: blue, fontWeight: '600' }}>Loading Learners...</p>
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
            🎓 Learner Management
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Manage all learner registrations and slot allocations
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
          { label: 'Total Learners', value: learners.length, colour: blue },
          { label: 'Approved', value: learners.filter(l => l.status === 'approved').length, colour: '#059669' },
          { label: 'Pending', value: learners.filter(l => l.status === 'pending').length, colour: '#d97706' },
          { label: 'Rejected', value: learners.filter(l => l.status === 'rejected').length, colour: '#dc2626' },
          { label: 'Suspended', value: learners.filter(l => l.status === 'suspended').length, colour: '#6b7280' },
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

      {/* Learners Table */}
      <div style={{
        background: 'white', borderRadius: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 2fr',
          padding: '12px 20px',
          background: lightBlue,
          borderBottom: '1px solid #e5e7eb',
        }}>
          {['Learner', 'Email', 'Status', 'Slots', 'Registered', 'Actions'].map((h, i) => (
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
        {filteredLearners.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🎓</p>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>No learners found</p>
          </div>
        ) : (
          filteredLearners.map((learner, index) => (
            <div
              key={learner.user_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 2fr',
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
                  {learner.first_name?.charAt(0)}{learner.surname?.charAt(0)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {learner.first_name} {learner.surname}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {learner.phone_number}
                  </p>
                </div>
              </div>

              {/* Email */}
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {learner.email}
              </p>

              {/* Status */}
              <div>{statusBadge(learner.status)}</div>

              {/* Slots */}
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>
                {learner.slots_allocated || 0}
              </p>

              {/* Date */}
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                {new Date(learner.created_at).toLocaleDateString()}
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {learner.status === 'pending' && (
                  <>
                    <button
                      onClick={() => approveUser(learner.user_id)}
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
                      onClick={() => rejectUser(learner.user_id)}
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
                {learner.status === 'approved' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedLearner(learner)
                        setSlotsToAssign(learner.slots_allocated?.toString() ?? '')

                      }}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        border: 'none',
                        background: `linear-gradient(135deg, ${blue}, ${orange})`,
                        color: 'white', fontSize: '11px',
                        fontWeight: '700', cursor: 'pointer',
                      }}
                    >
                      Assign Slots
                    </button>
                    <button
                      onClick={() => suspendUser(learner.user_id)}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        border: 'none', background: '#f3f4f6',
                        color: '#374151', fontSize: '11px',
                        fontWeight: '700', cursor: 'pointer',
                      }}
                    >
                      Suspend
                    </button>
                  </>
                )}
                {learner.status === 'suspended' && (
                  <button
                    onClick={() => approveUser(learner.user_id)}
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

      {/* Assign Slots Modal */}
      {selectedLearner && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '20px',
            padding: '32px', width: '100%',
            maxWidth: '400px', margin: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>
              Assign Lesson Slots
            </h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 24px' }}>
              Assigning slots to <strong>{selectedLearner.first_name} {selectedLearner.surname}</strong>
            </p>

            {error && (
              <div style={{
                background: '#fee2e2', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#991b1b', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151',
                marginBottom: '8px',
              }}>
                Number of Lesson Slots
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={slotsToAssign}
                onChange={(e) => setSlotsToAssign(e.target.value)}
                placeholder="Enter number of slots e.g. 4"
                style={{
                  width: '100%', padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px', outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setSelectedLearner(null)
                  setSlotsToAssign('')
                  setError('')
                }}
                style={{
                  flex: 1, padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: 'white', color: '#374151',
                  fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={assignSlots}
                disabled={assigningSlots}
                style={{
                  flex: 2, padding: '12px',
                  borderRadius: '10px', border: 'none',
                  background: assigningSlots
                    ? '#e5e7eb'
                    : `linear-gradient(135deg, ${blue}, ${orange})`,
                  color: assigningSlots ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: assigningSlots ? 'not-allowed' : 'pointer',
                }}
              >
                {assigningSlots ? 'Assigning...' : 'Assign Slots'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}