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

const supabase = createClient()

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

 const textMuted = '#94a3b8'
  const textDark = '#1e293b'

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (data?.role !== 'admin') router.push('/login')
  }, [router])

  const loadLearners = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'learner')
      .order('created_at', { ascending: false })

    setLearners(data || [])
    setLoading(false)
  }, [])

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

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ minHeight: '100%', padding: '0 0 24px' }}>

        {/* Success Message */}
        {successMessage && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px',
            marginBottom: '16px', color: '#16a34a', fontSize: '13px', fontWeight: '600',
          }}>
            ✅ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 16px',
            marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: '600',
          }}>
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
              { label: 'Total Learners', value: learners.length, colour: '#3b82f6' },
              { label: 'Approved', value: learners.filter(l => l.status === 'approved').length, colour: '#10b981' },
              { label: 'Pending', value: learners.filter(l => l.status === 'pending').length, colour: '#f59e0b' },
              { label: 'Rejected', value: learners.filter(l => l.status === 'rejected').length, colour: '#ef4444' },
              { label: 'Suspended', value: learners.filter(l => l.status === 'suspended').length, colour: '#64748b' },
            ].map((stat, i) => (
              <div
                key={i}
                onClick={() => setFilter(stat.label === 'Total Learners' ? 'all' : stat.label.toLowerCase())}
                style={{
                  background: 'white', borderRadius: '10px', padding: '20px 22px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${stat.colour}`,
                  cursor: 'pointer', transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
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
            style={{
              flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['all', 'approved', 'pending', 'rejected', 'suspended'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 14px', borderRadius: '20px',
                  border: filter === f ? 'none' : '1px solid #e2e8f0',
                  background: filter === f ? '#1e293b' : 'white',
                  color: filter === f ? 'white' : '#64748b',
                  fontSize: '12px', fontWeight: filter === f ? '700' : '500',
                  cursor: 'pointer', textTransform: 'capitalize',
                  transition: 'all 0.2s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Learners Table */}
        <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1.5fr 2fr',
            padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          }}>
            {['Learner', 'Email', 'Status', 'Slots', 'Registered', 'Actions'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
            ))}
          </div>

          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1.5fr 2fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Skeleton w="36px" h="36px" r="50%" /><div><Skeleton w="100px" h="13px" r="4px" /><div style={{ marginTop: '5px' }}><Skeleton w="70px" h="10px" r="4px" /></div></div></div>
                <Skeleton w="120px" h="12px" r="4px" />
                <Skeleton w="60px" h="22px" r="12px" />
                <Skeleton w="30px" h="13px" r="4px" />
                <Skeleton w="80px" h="11px" r="4px" />
                <div style={{ display: 'flex', gap: '8px' }}><Skeleton w="60px" h="28px" r="6px" /></div>
              </div>
            ))
          ) : filteredLearners.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🎓</p>
              <p style={{ color: textMuted, fontSize: '14px', fontWeight: '500' }}>No learners found matching your criteria</p>
            </div>
          ) : (
            filteredLearners.map((learner) => (
              <div
                key={learner.user_id}
                style={{
                  display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1.5fr 2fr',
                  padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center',
                }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: textDark, fontWeight: '700', fontSize: '13px', flexShrink: 0,
                  }}>
                    {learner.first_name?.charAt(0)}{learner.surname?.charAt(0)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: textDark }}>{learner.first_name} {learner.surname}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>{learner.phone_number || 'No phone'}</p>
                  </div>
                </div>

                {/* Email */}
                <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>{learner.email}</p>

                {/* Status */}
                <div>{statusBadge(learner.status)}</div>

                {/* Slots */}
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: textDark }}>{learner.slots_allocated || 0}</p>

                {/* Date */}
                <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>{new Date(learner.created_at).toLocaleDateString()}</p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {learner.status === 'pending' && (
                    <>
                      <button onClick={() => approveUser(learner.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Approve</button>
                      <button onClick={() => rejectUser(learner.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Reject</button>
                    </>
                  )}
                  {learner.status === 'approved' && (
                    <>
                      <button
                        onClick={() => { setSelectedLearner(learner); setSlotsToAssign(learner.slots_allocated?.toString() ?? '') }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#1e293b', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Assign Slots
                      </button>
                      <button onClick={() => suspendUser(learner.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Suspend</button>
                    </>
                  )}
                  {learner.status === 'suspended' && (
                    <button onClick={() => approveUser(learner.user_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Reactivate</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Assign Slots Modal */}
        {selectedLearner && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: textDark }}>Assign Lesson Slots</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: textMuted }}>
                Assigning slots to <strong>{selectedLearner.first_name} {selectedLearner.surname}</strong>
              </p>

              {error && (
                <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '12px' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Number of Lesson Slots
                </label>
                <input
                  type="number" min="1" max="50"
                  value={slotsToAssign}
                  onChange={(e) => setSlotsToAssign(e.target.value)}
                  placeholder="e.g. 10"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '16px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setSelectedLearner(null); setSlotsToAssign(''); setError('') }}
                  style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={assignSlots}
                  disabled={assigningSlots}
                  style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: assigningSlots ? '#94a3b8' : '#1e293b', color: 'white', fontSize: '13px', fontWeight: '700', cursor: assigningSlots ? 'not-allowed' : 'pointer' }}
                >
                  {assigningSlots ? 'Assigning...' : 'Assign Slots'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
