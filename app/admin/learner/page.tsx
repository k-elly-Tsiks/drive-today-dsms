'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Search, 
  Filter, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  BookOpen, 
  Ticket, 
  Calendar, 
  X, 
  MoreVertical, 
  Edit3, 
  CheckCircle, 
  MinusCircle, 
  RefreshCw,
  AlertCircle
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Learner = {
  user_id: string
  first_name: string
  second_name?: string | null
  surname: string
  email: string
  phone_number?: string | null
  address?: string | null
  status: 'approved' | 'pending' | 'rejected' | 'suspended'
  role: string
  slots_allocated?: number
  driving_class?: string | null
  // optional debug field (only if column exists)
  driving_classes_taken?: string | null




  dob?: string | null
  gender?: string | null
  id_number?: string | null
  provisional_expiry?: string | null
  licence_number?: string | null
  licence_code?: string | null
  licence_validity?: string | null
  created_at: string
}


type Lesson = {
  id: string
  lesson_date: string
  start_time: string
  status: string
}

// ── Components ─────────────────────────────────────────────────────────────────

function Avatar({ name, size = 38, idx = 0 }: { name: string; size?: number; idx?: number }) {
  const avatarColors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777']
  const initials = name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColors[idx % avatarColors.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700', fontSize: size * 0.35, flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>{initials}</div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; dot: string; label: string }> = {
    approved:  { bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a', label: 'Active' },
    pending:   { bg: '#fffbeb', color: '#d97706', dot: '#f59e0b', label: 'Pending' },
    suspended: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'Suspended' },
    rejected:  { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Rejected' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', background: s.bg, color: s.color, border: `1px solid ${s.bg}` }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function TableSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 1fr 60px', padding: '20px 24px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="skeleton-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-pulse" style={{ width: '120px', height: '14px', borderRadius: '4px', background: '#e2e8f0', marginBottom: '8px' }} />
              <div className="skeleton-pulse" style={{ width: '80px', height: '11px', borderRadius: '4px', background: '#e2e8f0' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '90px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '110px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '70px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '75px', height: '22px', borderRadius: '12px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '30px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LearnersPage() {
  const [learners, setLearners]         = useState<Learner[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [classFilter, setClassFilter]   = useState('all')
  const [openMenu, setOpenMenu]         = useState<string | null>(null)

  // Modals
  const [viewLearner, setViewLearner]   = useState<Learner | null>(null)
  const [isEditing, setIsEditing]       = useState(false)
  const [editModal, setEditModal]       = useState<Learner | null>(null)
  const [slotsModal, setSlotsModal]       = useState<Learner | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ type: 'approve' | 'deactivate' | 'reactivate'; learner: Learner } | null>(null)
  
  const [learnerLessons, setLearnerLessons] = useState<Lesson[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [slotsInput, setSlotsInput]         = useState('')
  const [slotsUsed, setSlotsUsed]           = useState<number | null>(null)
  const [slotsBookable, setSlotsBookable]   = useState(0)
  const [slotsMode, setSlotsMode]           = useState<'set' | 'extra'>('set')
  const [actionLoading, setActionLoading]   = useState(false)
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedLearnerId = searchParams.get('selected')
  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement | null>(null)

  const classOptions = ['Provisional', 'Class 1', 'Class 2', 'Class 3', 'Class 4']

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Close menus on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!loading && selectedLearnerId && learners.length > 0) {
      const learner = learners.find(l => l.user_id === selectedLearnerId)
      if (learner) setViewLearner(learner)
    }
  }, [loading, selectedLearnerId, learners])

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadLearners = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'learner')
      .order('created_at', { ascending: false })

    if (error) {
      showToast('Error retrieving learners data.', 'error')
    } else {
      setLearners(data || [])
    }
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { loadLearners() }, [loadLearners])

  useEffect(() => {
    setIsEditing(false)
  }, [viewLearner])

  useEffect(() => {
    if (viewLearner) {
      const fetchSchedule = async () => {
        setLoadingLessons(true)
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('learner_id', viewLearner.user_id)
          .order('lesson_date', { ascending: true })
          
        if (!error) {
          setLearnerLessons(data || [])
        }
        setLoadingLessons(false)
      }
      fetchSchedule()
    }
  }, [viewLearner, supabase])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editModal) return
    
    setActionLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      const drivingClassVal = (fd.get('cls') as string) || null
      if (!drivingClassVal) {
        showToast("Please select the learner's driving class.", 'error')
        return
      }
      const updates = {
        first_name: fd.get('fn') as string,
        surname: fd.get('sn') as string,
        phone_number: (fd.get('ph') as string) || null,
        address: (fd.get('addr') as string) || null,
        driving_class: drivingClassVal,
        driving_classes_taken: drivingClassVal,
      }
      
      const { error } = await supabase.from('users').update(updates).eq('user_id', editModal.user_id)
      if (error) throw error

      setLearners(prev => prev.map(l => l.user_id === editModal.user_id ? { ...l, ...updates } : l))
      
      // Update view modal details synchronously if they belong to the same learner
      if (viewLearner && viewLearner.user_id === editModal.user_id) {
        setViewLearner(prev => prev ? { ...prev, ...updates } : null)
      }

      showToast('Profile updated successfully.', 'success')
      setEditModal(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err ? JSON.stringify(err) : 'Failed to update learner')
      showToast(message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  async function onSaveDetailEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!viewLearner) return
    
    setActionLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      const drivingClassVal = (fd.get('driving_class') as string) || null
      if (!drivingClassVal) {
        showToast("Please select the learner's driving class.", 'error')
        return
      }
      const updates = {
        first_name: fd.get('first_name') as string,
        second_name: (fd.get('second_name') as string) || null,
        surname: fd.get('surname') as string,
        phone_number: (fd.get('phone_number') as string) || null,
        address: (fd.get('address') as string) || null,
        dob: (fd.get('dob') as string) || null,
        gender: (fd.get('gender') as string) || null,
        id_number: (fd.get('id_number') as string) || null,
        driving_class: drivingClassVal,
        driving_classes_taken: drivingClassVal,
        licence_number: (fd.get('licence_number') as string) || null,
        licence_code: (fd.get('licence_code') as string) || null,
        licence_validity: (fd.get('licence_validity') as string) || null,
        provisional_expiry: (fd.get('provisional_expiry') as string) || null,
      }
      
      const { error } = await supabase.from('users').update(updates).eq('user_id', viewLearner.user_id)
      if (error) throw error

      setLearners(prev => prev.map(l => l.user_id === viewLearner.user_id ? { ...l, ...updates } : l))
      setViewLearner(prev => prev ? { ...prev, ...updates } : null)

      showToast('Profile updated successfully.', 'success')
      setIsEditing(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err ? JSON.stringify(err) : 'Failed to update learner')
      showToast(message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Booked and completed lessons both use up a slot; cancelled ones give it back.
  async function countUsedSlots(learnerId: string) {
    const { count, error } = await supabase
      .from('lesson_bookings')
      .select('booking_id', { count: 'exact', head: true })
      .eq('learner_id', learnerId)
      .neq('status', 'cancelled')
    if (error) throw error
    return count ?? 0
  }

  async function openSlotsModal(learner: Learner, mode: 'set' | 'extra') {
    setSlotsModal(learner)
    setSlotsMode(mode)
    setSlotsUsed(null)
    setSlotsInput('')
    try {
      const used = await countUsedSlots(learner.user_id)
      const allocated = Number(learner.slots_allocated) || 0
      setSlotsUsed(used)
      setSlotsBookable(Math.max(0, allocated - used))
      setSlotsInput(mode === 'extra' ? '1' : String(Math.max(0, allocated - used)))
    } catch {
      showToast('Could not load the learner booking history.', 'error')
      setSlotsModal(null)
    }
  }

  async function onUpdateSlots() {
    if (!slotsModal) return
    const num = parseInt(slotsInput)
    if (isNaN(num) || num < (slotsMode === 'extra' ? 1 : 0)) {
      showToast(slotsMode === 'extra' ? 'Enter at least 1 extra lesson.' : 'Please insert a valid slot configuration balance.', 'error')
      return
    }
    setActionLoading(true)

    // The stored total must also cover the lessons already booked or completed.
    // "Set" makes num the new bookable balance; "extra" adds num on top of it.
    let total: number
    let bookable: number
    try {
      const used = await countUsedSlots(slotsModal.user_id)
      const allocated = Number(slotsModal.slots_allocated) || 0
      total = slotsMode === 'extra' ? Math.max(allocated, used) + num : used + num
      bookable = total - used
    } catch {
      showToast('Could not load the learner booking history.', 'error')
      setActionLoading(false)
      return
    }

    const { data: updatedLearner, error } = await supabase
      .from('users')
      .update({ slots_allocated: total })
      .eq('user_id', slotsModal.user_id)
      .select('user_id')
      .maybeSingle()
    if (!error && updatedLearner) {
      setLearners(prev => prev.map(l => l.user_id === slotsModal.user_id ? { ...l, slots_allocated: total } : l))

      if (viewLearner && viewLearner.user_id === slotsModal.user_id) {
        setViewLearner(prev => prev ? { ...prev, slots_allocated: total } : null)
      }

      await supabase.from('notifications').insert({
        recipient_id: slotsModal.user_id,
        message: slotsMode === 'extra'
          ? `You have been given ${num} extra lesson(s). You can now book ${bookable} lesson(s) - choose your slots under My Lessons.`
          : `Your lesson allowance has been updated. You can now book ${bookable} lesson(s) - choose your slots under My Lessons.`,
        type: 'approval',
      })

      showToast(`${slotsModal.first_name} can now book ${bookable} slot(s).`, 'success')
      setSlotsModal(null)
      setSlotsInput('')
    } else {
      showToast(error?.message || 'No learner record was updated.', 'error')
    }
    setActionLoading(false)
  }

  async function onConfirmStatus() {
    if (!confirmModal) return
    setActionLoading(true)
    const { learner, type } = confirmModal
    const newStatus = (type === 'approve' || type === 'reactivate') ? 'approved' : 'suspended'
    
    type StatusPayload = { status: Learner['status']; slots_allocated?: number }
    const payload: StatusPayload = { status: newStatus }
    if (type === 'approve') {
      const slots = parseInt(slotsInput)
      if (isNaN(slots) || slots < 1) {
        showToast('Please allocate at least 1 lesson slot.', 'error')
        setActionLoading(false)
        return
      }
      payload.slots_allocated = slots
    }

    const { data: saved, error } = await supabase
      .from('users')
      .update(payload)
      .eq('user_id', learner.user_id)
      .select('user_id')
      .maybeSingle()
    if (!error && saved) {
      setLearners(prev => prev.map(l => l.user_id === learner.user_id ? { ...l, ...payload } : l))
      
      if (viewLearner && viewLearner.user_id === learner.user_id) {
        setViewLearner(prev => prev ? { ...prev, ...payload } : null)
      }

      showToast(`User verification structure is now updated to: ${newStatus}`, 'success')
      setConfirmModal(null)
      setSlotsInput('')
    } else {
      showToast(
        `Could not finalize status changes: ${error?.message || 'no learner record was updated.'}`,
        'error'
      )
    }
    setActionLoading(false)
  }

  const filtered = learners.filter(l => {
    const q = search.toLowerCase()
    return (
      (!q || `${l.first_name} ${l.surname} ${l.email}`.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || l.status === statusFilter) &&
      (classFilter === 'all' || l.driving_class === classFilter || l.driving_classes_taken === classFilter)
    )
  })


  return (
    <>
      <style>{`
        .learner-row { transition: all 0.2s ease; }
        .learner-row:hover { background: #f8fafc; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(11, 19, 41, 0.4); display: flex; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(8px); padding: 20px; animation: fadeIn 0.2s ease; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 750px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .info-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; padding: 24px; }
        @media (max-width: 680px) { .info-grid { grid-template-columns: 1fr; } }
        .info-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
        .info-value { font-size: 14.5px; font-weight: 600; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .schedule-card { background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; height: fit-content; }
        
        .menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 13px; font-weight: 500; cursor: pointer; color: #475569; transition: all 0.15s ease; text-align: left; }
        .menu-item:hover { background: #fff1eb; color: #ff5a00; }
        
        .custom-btn-secondary { background: white; border: 1px solid #e2e8f0; padding: 10px 16px; font-size: 13px; font-weight: 600; border-radius: 10px; color: #475569; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 8px; }
        .custom-btn-secondary:hover { border-color: #ff5a00; color: #ff5a00; background: #fff1eb; }
        
        .custom-btn-primary { background: #ff5a00; border: none; padding: 10px 18px; font-size: 13px; font-weight: 600; border-radius: 10px; color: white; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(255, 90, 0, 0.15); }
        .custom-btn-primary:hover { background: #e04f00; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255, 90, 0, 0.25); }
        .custom-btn-primary:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
        
        .form-control { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13.5px; font-weight: 500; color: #1e293b; background: #ffffff; transition: all 0.15s ease; }
        .form-control:focus { outline: none; border-color: #ff5a00; box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.1); }
        
        .skeleton-pulse { animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, padding: '14px 24px', borderRadius: '12px', background: toast.type === 'success' ? '#0b1329' : '#dc2626', color: 'white', fontWeight: '600', fontSize: '13.5px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {toast.type === 'error' ? <AlertCircle size={16} color="#ff8a8a" /> : <CheckCircle size={16} color="#4ade80" />}
          {toast.msg}
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {viewLearner && (
        <div className="modal-overlay" onClick={() => setViewLearner(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Avatar name={`${viewLearner.first_name} ${viewLearner.second_name ? viewLearner.second_name + ' ' : ''}${viewLearner.surname}`} size={52} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{viewLearner.first_name} {viewLearner.second_name ? viewLearner.second_name + ' ' : ''}{viewLearner.surname}</h2>
                    <div style={{ marginTop: '4px' }}><StatusBadge status={viewLearner.status} /></div>
                  </div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {!isEditing && (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="custom-btn-secondary" 
                      style={{ padding: '6px 14px', fontSize: '13px', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit3 size={14} /> Edit Info
                    </button>
                  )}
                  <button onClick={() => setViewLearner(null)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={16} /></button>
               </div>
            </div>

            <form onSubmit={onSaveDetailEdit} className="info-grid">
              <div>
                {isEditing ? (
                  <>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', margin: '0 0 16px' }}>Edit Personal & Contact Details</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="info-label">First Name</label>
                        <input name="first_name" defaultValue={viewLearner.first_name} className="form-control" required />
                      </div>
                      <div>
                        <label className="info-label">Second Name</label>
                        <input name="second_name" defaultValue={viewLearner.second_name || ''} className="form-control" />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="info-label">Surname</label>
                      <input name="surname" defaultValue={viewLearner.surname} className="form-control" required />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="info-label">Phone Number</label>
                      <input name="phone_number" defaultValue={viewLearner.phone_number || ''} className="form-control" placeholder="e.g. +263..." />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="info-label">Home Address</label>
                      <input name="address" defaultValue={viewLearner.address || ''} className="form-control" placeholder="Street address details" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="info-label">Date of Birth</label>
                        <input type="date" name="dob" defaultValue={viewLearner.dob ? new Date(viewLearner.dob).toISOString().split('T')[0] : ''} className="form-control" />
                      </div>
                      <div>
                        <label className="info-label">Gender</label>
                        <select name="gender" defaultValue={viewLearner.gender || ''} className="form-control" style={{ cursor: 'pointer' }}>
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="info-label">National ID Number</label>
                      <input name="id_number" defaultValue={viewLearner.id_number || ''} className="form-control" />
                    </div>

                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', margin: '24px 0 16px' }}>Licence & Training Details</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="info-label">Required Driving Class</label>
                        <select name="driving_class" defaultValue={viewLearner.driving_class || viewLearner.driving_classes_taken || ''} className="form-control" style={{ cursor: 'pointer' }} required>
                          <option value="">Select Class</option>
                          {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="info-label">Available Slots</div>
                        <div className="info-value" style={{ color: '#ff5a00', margin: 0 }}><Ticket size={15} color="#ff5a00" /> <b>{Number(viewLearner.slots_allocated) || 0} slots</b></div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="info-label">Provisional Expiry Date</label>
                      <input type="date" name="provisional_expiry" defaultValue={viewLearner.provisional_expiry ? new Date(viewLearner.provisional_expiry).toISOString().split('T')[0] : ''} className="form-control" />
                    </div>

                    <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#0b1329', margin: '20px 0 10px' }}>License Information</h3>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#f8fafc', marginBottom: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label className="info-label">License Number</label>
                          <input name="licence_number" defaultValue={viewLearner.licence_number || ''} className="form-control" />
                        </div>
                        <div>
                          <label className="info-label">License Code</label>
                          <input name="licence_code" defaultValue={viewLearner.licence_code || ''} className="form-control" placeholder="e.g. Code 4" />
                        </div>
                      </div>
                      <div>
                        <label className="info-label">License Expiry / Validity</label>
                        <input type="date" name="licence_validity" defaultValue={viewLearner.licence_validity ? new Date(viewLearner.licence_validity).toISOString().split('T')[0] : ''} className="form-control" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button type="submit" className="custom-btn-primary" disabled={actionLoading} style={{ flex: 1, justifyContent: 'center' }}>
                        {actionLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button type="button" className="custom-btn-secondary" onClick={() => setIsEditing(false)} style={{ flex: 1, justifyContent: 'center' }}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', margin: '0 0 16px' }}>Personal Profile & Contact</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div className="info-label">First Name</div>
                        <div className="info-value" style={{ margin: 0 }}>{viewLearner.first_name}</div>
                      </div>
                      <div>
                        <div className="info-label">Second Name</div>
                        <div className="info-value" style={{ margin: 0 }}>{viewLearner.second_name || '—'}</div>
                      </div>
                    </div>

                    <div className="info-label" style={{ marginTop: '16px' }}>Surname</div>
                    <div className="info-value">{viewLearner.surname}</div>

                    <div className="info-label">Email Address</div>
                    <div className="info-value"><Mail size={15} color="#94a3b8" /> {viewLearner.email}</div>
                    
                    <div className="info-label">Phone Number</div>
                    <div className="info-value"><Phone size={15} color="#94a3b8" /> {viewLearner.phone_number || '—'}</div>
                    
                    <div className="info-label">Home Address</div>
                    <div className="info-value"><MapPin size={15} color="#94a3b8" /> {viewLearner.address || '—'}</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                      <div>
                        <div className="info-label">Date of Birth</div>
                        <div className="info-value" style={{ margin: 0 }}>{viewLearner.dob ? new Date(viewLearner.dob).toLocaleDateString() : '—'}</div>
                      </div>
                      <div>
                        <div className="info-label">Gender</div>
                        <div className="info-value" style={{ margin: 0 }}>{viewLearner.gender || '—'}</div>
                      </div>
                    </div>

                    <div className="info-label" style={{ marginTop: '16px' }}>National ID Number</div>
                    <div className="info-value">{viewLearner.id_number || '—'}</div>

                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', margin: '24px 0 16px' }}>Licence & Training Details</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div className="info-label">Required Driving Class</div>
                        <div className="info-value" style={{ margin: 0 }}><BookOpen size={15} color="#94a3b8" /> {viewLearner.driving_class || viewLearner.driving_classes_taken || '—'}</div>
                      </div>
                      <div>
                        <div className="info-label">Available Slots</div>
                        <div className="info-value" style={{ color: '#ff5a00', margin: 0 }}><Ticket size={15} color="#ff5a00" /> <b>{Number(viewLearner.slots_allocated) || 0} slots</b></div>
                      </div>
                    </div>

                    <div className="info-label" style={{ marginTop: '16px' }}>Provisional Expiry Date</div>
                    <div className="info-value">{viewLearner.provisional_expiry ? new Date(viewLearner.provisional_expiry).toLocaleDateString() : '—'}</div>

                    <div className="info-label" style={{ marginTop: '16px' }}>Licence Information</div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc', marginBottom: '16px' }}>
                      <div className="info-value" style={{ margin: 0, justifyContent: 'space-between' }}>
                        <span>{viewLearner.licence_number || 'No licence number'}</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', background: '#e2e8f0', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>
                          Code: {viewLearner.licence_code || 'N/A'}
                        </span>
                      </div>
                      <div className="info-label" style={{ marginTop: '8px', marginBottom: '2px' }}>Validity</div>
                      <div className="info-value" style={{ margin: 0, fontSize: '13px' }}>
                        {viewLearner.licence_validity ? `Expires on ${new Date(viewLearner.licence_validity).toLocaleDateString()}` : '—'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="schedule-card" style={{ height: 'fit-content' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} color="#64748b" /> Training Schedule</h3>
                {loadingLessons ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }} className="skeleton-pulse">Fetching records...</div>
                ) : learnerLessons.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                    <p style={{ fontSize: '13px', margin: 0 }}>No dynamic lessons allocated yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {learnerLessons.map(lesson => (
                      <div key={lesson.id} style={{ background: 'white', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{new Date(lesson.lesson_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{lesson.start_time}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>{lesson.status.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <form className="modal-card" style={{ maxWidth: '440px', padding: '24px' }} onClick={e => e.stopPropagation()} onSubmit={onSaveEdit}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: '#0b1329' }}>Edit Learner Details</h3>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label className="info-label">First Name</label>
                <input name="fn" defaultValue={editModal.first_name} className="form-control" required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="info-label">Surname</label>
                <input name="sn" defaultValue={editModal.surname} className="form-control" required />
              </div>
            </div>
            
            <div style={{ marginBottom: '14px' }}>
              <label className="info-label">Phone Connection</label>
              <input name="ph" defaultValue={editModal.phone_number || ''} className="form-control" placeholder="e.g. +263..." />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="info-label">Address Placement</label>
              <input name="addr" defaultValue={editModal.address || ''} className="form-control" placeholder="Street layout details" />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="info-label">Target Driving License Class (required)</label>
              <select name="cls" defaultValue={editModal.driving_class || editModal.driving_classes_taken || ''} className="form-control" style={{ cursor: 'pointer' }} required>
                <option value="">Select Target Class</option>
                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="custom-btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="submit" disabled={actionLoading} className="custom-btn-primary">
                {actionLoading ? 'Saving Info...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REALLOCATE SLOTS BALANCE MODAL */}
      {slotsModal && (
        <div className="modal-overlay" onClick={() => setSlotsModal(null)}>
          <div className="modal-card" style={{ maxWidth: '360px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0b1329' }}>{slotsMode === 'extra' ? 'Add Extra Lessons' : 'Assign Program Slots'}</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 8px' }}>
              {slotsMode === 'extra'
                ? <>How many extra lessons should <b>{slotsModal.first_name}</b> get?</>
                : <>How many slots can <b>{slotsModal.first_name}</b> book from now on?</>}
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 20px' }}>
              {slotsUsed === null
                ? 'Loading booking history...'
                : `${slotsUsed} lesson(s) already booked or completed are not affected. Currently able to book: ${slotsBookable}.`}
            </p>

            <input type="number" min="0" autoFocus value={slotsInput} onChange={e => setSlotsInput(e.target.value)} style={{ width: '100%', padding: '12px', fontSize: '20px', borderRadius: '10px', border: '2px solid #e2e8f0', marginBottom: '20px', textAlign: 'center', fontWeight: '700', color: '#0b1329' }} placeholder="0" />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSlotsModal(null)}>Cancel</button>
              <button className="custom-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onUpdateSlots} disabled={actionLoading || slotsUsed === null}>Update Balance</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION PIPELINE MODAL */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-card" style={{ maxWidth: '380px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#0b1329', textTransform: 'capitalize' }}>Confirm Account Status</h3>
            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 20px', lineHeight: 1.5 }}>
              Are you sure you want to proceed with executing a status shift alteration (<b>{confirmModal.type}</b>) on student account profile belonging to <b>{confirmModal.learner.first_name} {confirmModal.learner.surname}</b>?
            </p>
            
            {confirmModal.type === 'approve' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="info-label">Grant Initial Booking Slots</label>
                <input type="number" min="0" value={slotsInput} onChange={e => setSlotsInput(e.target.value)} className="form-control" placeholder="Defaults to 0 if left empty" />
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmModal(null)}>Cancel Action</button>
              <button className="custom-btn-primary" style={{ flex: 1, justifyContent: 'center', background: '#0b1329', boxShadow: 'none' }} onClick={onConfirmStatus} disabled={actionLoading}>
                {actionLoading ? 'Processing...' : 'Confirm Mutation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT WRAPPER */}
      <div style={{ background: 'transparent' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '800', color: '#0b1329', letterSpacing: '-0.5px' }}>Learners Management</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Review, filter, and adapt student statuses or dynamic lesson token metrics</p>
        </div>

        {/* CONTROLS SECTION */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input placeholder="Search profiles via first name, surname or email..." value={search} onChange={e => setSearch(e.target.value)} className="form-control" style={{ paddingLeft: '40px', height: '42px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} />
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Filter size={14} color="#64748b" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ paddingLeft: '32px', height: '42px', width: '140px', cursor: 'pointer', background: 'white', fontSize: '13px', fontWeight: '600' }}>
                <option value="all">All Status</option>
                <option value="approved">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <BookOpen size={14} color="#64748b" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="form-control" style={{ paddingLeft: '32px', height: '42px', width: '150px', cursor: 'pointer', background: 'white', fontSize: '13px', fontWeight: '600' }}>
                <option value="all">All Classes</option>
                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* DATAGRID CONTAINER */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '900px' }}>

              {/* Header Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 1fr 60px', padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
                <span>LEARNER</span>
                <span style={{ textAlign: 'center' }}>PHONE NUMBER</span>
                <span style={{ textAlign: 'center' }}>ADDRESS</span>
                <span style={{ textAlign: 'center' }}>DRIVING CLASS</span>
                <span style={{ textAlign: 'center' }}>ACCOUNT STATUS</span>
                <span style={{ textAlign: 'center' }}>ALLOCATED SLOTS</span>
                <span></span>
              </div>

              {/* Data Rows */}
              {loading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <div style={{ padding: '50px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
                  No learners match the current search or filter.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filtered.map((l, idx) => (
                    <div key={l.user_id} className="learner-row" onClick={() => setViewLearner(l)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 1fr 60px', padding: '14px 24px', alignItems: 'center', borderTop: idx !== 0 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>

                      {/* Learner identity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <Avatar name={`${l.first_name} ${l.second_name ? l.second_name + ' ' : ''}${l.surname}`} idx={idx} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.first_name} {l.second_name ? l.second_name + ' ' : ''}{l.surname}</div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{l.email}</div>
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', textAlign: 'center' }}>
                        {l.phone_number || '—'}
                      </div>

                      {/* Address */}
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.address || '—'}
                      </div>

                      {/* Driving Class */}
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', textAlign: 'center' }}>
                        {(l.driving_class || l.driving_classes_taken) ? (
                          <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            {l.driving_class || l.driving_classes_taken}
                          </span>
                        ) : '—'}
                      </div>

                      {/* Account Status */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StatusBadge status={l.status} />
                      </div>

                      {/* Allocated Slots */}
                      <div style={{ fontWeight: '700', color: '#ff5a00', fontSize: '15px', textAlign: 'center' }}>
                        {Number(l.slots_allocated) || 0}
                      </div>

                      {/* Action dots */}
                      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenu(openMenu === l.user_id ? null : l.user_id)} style={{ border: 'none', background: 'transparent', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                          <MoreVertical size={16} />
                        </button>

                        {openMenu === l.user_id && (
                          <div ref={menuRef} style={{ position: 'absolute', right: '100%', top: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)', zIndex: 100, width: '180px', overflow: 'hidden', marginRight: '4px' }}>
                            <button className="menu-item" onClick={() => { setViewLearner(l); setOpenMenu(null); }}><User size={14} /> View Record</button>
                            <button className="menu-item" onClick={() => { setEditModal(l); setOpenMenu(null); }}><Edit3 size={14} /> Edit Details</button>
                            <button className="menu-item" onClick={() => { void openSlotsModal(l, 'set'); setOpenMenu(null); }}><Ticket size={14} /> Reallocate Slots</button>
                            <button className="menu-item" onClick={() => { void openSlotsModal(l, 'extra'); setOpenMenu(null); }}><Ticket size={14} /> Add Extra Lessons</button>
                            {l.status === 'pending' && (
                              <button className="menu-item" style={{ color: '#16a34a' }} onClick={() => { setConfirmModal({ type: 'approve', learner: l }); setOpenMenu(null); }}><CheckCircle size={14} /> Approve Account</button>
                            )}
                            {l.status === 'approved' && (
                              <button className="menu-item" style={{ color: '#dc2626' }} onClick={() => { setConfirmModal({ type: 'deactivate', learner: l }); setOpenMenu(null); }}><MinusCircle size={14} /> Suspend Learner</button>
                            )}
                            {l.status === 'suspended' && (
                              <button className="menu-item" style={{ color: '#2563eb' }} onClick={() => { setConfirmModal({ type: 'reactivate', learner: l }); setOpenMenu(null); }}><RefreshCw size={14} /> Reactivate Profile</button>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </>
  )
}