'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Filter, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Award, 
  Zap, 
  Calendar, 
  X, 
  MoreVertical, 
  Edit3, 
  CheckCircle, 
  Ban, 
  RotateCcw, 
  AlertCircle
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Instructor = {
  user_id: string
  first_name: string
  surname: string
  email: string
  phone_number?: string
  address?: string
  status: 'approved' | 'pending' | 'rejected' | 'suspended'
  role: string
  driving_classes_taught?: string 
  workload_capacity?: number // Equivalent to "Slots" for learners
  created_at: string
}


type Lesson = {
  id: string
  lesson_date: string
  start_time: string
  status: string
  learner?: { first_name: string; surname: string }
}

type TrainingClass = {
  class_name: string 
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
    pending:   { bg: '#fff7ed', color: '#ea580c', dot: '#f97316', label: 'Pending' },
    suspended: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'Deactivated' },
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
        <div key={i} className="skeleton-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px', padding: '20px 24px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="skeleton-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-pulse" style={{ width: '120px', height: '14px', borderRadius: '4px', background: '#e2e8f0', marginBottom: '8px' }} />
              <div className="skeleton-pulse" style={{ width: '160px', height: '11px', borderRadius: '4px', background: '#e2e8f0' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '80px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '75px', height: '22px', borderRadius: '12px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '30px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '90px', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton-pulse" style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InstructorsPage() {
  const [instructors, setInstructors]     = useState<Instructor[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [classFilter, setClassFilter]     = useState('all')
  const [openMenu, setOpenMenu]           = useState<string | null>(null)

  // Modals
  const [viewInstructor, setViewInstructor] = useState<Instructor | null>(null)
  const [editModal, setEditModal]           = useState<Instructor | null>(null)
  const [capacityModal, setCapacityModal]   = useState<Instructor | null>(null)
  const [confirmModal, setConfirmModal]     = useState<{ type: 'approve' | 'deactivate' | 'reactivate'; instructor: Instructor } | null>(null)
  
  const [instructorLessons, setInstructorLessons] = useState<Lesson[]>([])
  const [loadingLessons, setLoadingLessons]       = useState(false)
  const [capacityInput, setCapacityInput]         = useState('')
  const [actionLoading, setActionLoading]         = useState(false)
  const [toast, setToast]                         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [classOptions, setClassOptions] = useState<string[]>([])

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

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadInstructors = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'instructor')
        .order('created_at', { ascending: false })
    
    if (error) {
      showToast('Error retrieving instructors data.', 'error')
    } else {
      setInstructors(data || [])
    }
    setLoading(false)
  }, [router, supabase])

   const loadTrainingClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from('training_classes') 
      .select('class_name')
      .order('class_name', { ascending: true })

    if (!error && data) {
      setClassOptions(data.map((item: TrainingClass) => item.class_name))
    }
  }, [supabase])

  useEffect(() => { 
    loadInstructors() 
    loadTrainingClasses() // Add this call
  }, [loadInstructors, loadTrainingClasses]) 

  useEffect(() => {
    if (viewInstructor) {
      const fetchSchedule = async () => {
        setLoadingLessons(true)
        const { data, error } = await supabase
          .from('lessons')
          .select('*, learner:users(first_name, surname)')
          .eq('instructor_id', viewInstructor.user_id)
          .order('lesson_date', { ascending: true })
        if (!error) {
          setInstructorLessons(data || [])
        }
        setLoadingLessons(false)
      }
      fetchSchedule()
    }
  }, [viewInstructor, supabase])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editModal) return
    
    setActionLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      const updates = {
        first_name: fd.get('fn') as string,
        surname: fd.get('sn') as string,
        phone_number: fd.get('ph') as string,
        address: fd.get('addr') as string,
        driving_classes_taught: fd.get('cls') as string,
      }
      
      const { error } = await supabase.from('users').update(updates).eq('user_id', editModal.user_id)
      if (error) throw error

      setInstructors(prev => prev.map(i => i.user_id === editModal.user_id ? { ...i, ...updates } : i))
      
      if (viewInstructor?.user_id === editModal.user_id) {
        setViewInstructor(prev => prev ? { ...prev, ...updates } : null)
      }

      showToast('Instructor profile updated successfully.', 'success')
      setEditModal(null)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  async function onUpdateCapacity() {
    if (!capacityModal) return
    const num = parseInt(capacityInput)
    if (isNaN(num) || num < 0) {
      showToast('Please enter a valid capacity number.', 'error')
      return
    }

    setActionLoading(true)
    const { error } = await supabase.from('users').update({ workload_capacity: num }).eq('user_id', capacityModal.user_id)
    
    if (!error) {
      setInstructors(prev => prev.map(i => i.user_id === capacityModal.user_id ? { ...i, workload_capacity: num } : i))
      if (viewInstructor?.user_id === capacityModal.user_id) {
        setViewInstructor(prev => prev ? { ...prev, workload_capacity: num } : null)
      }
      showToast('Teaching capacity updated successfully.', 'success')
      setCapacityModal(null)
      setCapacityInput('')
    } else {
      showToast('Failed to update capacity.', 'error')
    }
    setActionLoading(false)
  }

  async function onConfirmStatus() {
    if (!confirmModal) return
    setActionLoading(true)
    const { instructor, type } = confirmModal
    const newStatus = (type === 'approve' || type === 'reactivate') ? 'approved' : 'suspended'

    const { error } = await supabase.from('users').update({ status: newStatus }).eq('user_id', instructor.user_id)
    if (!error) {
      setInstructors(prev => prev.map(i => i.user_id === instructor.user_id ? { ...i, status: newStatus } : i))
      
      if (viewInstructor?.user_id === instructor.user_id) {
        setViewInstructor(prev => prev ? { ...prev, status: newStatus } : null)
      }

      showToast(`Instructor status updated to: ${newStatus}`, 'success')
      setConfirmModal(null)
    } else {
      showToast(error.message, 'error')
    }
    setActionLoading(false)
  }

  const filtered = instructors.filter(i => {
    const q = search.toLowerCase()
    return (!q || `${i.first_name} ${i.surname} ${i.email}`.toLowerCase().includes(q)) &&
           (statusFilter === 'all' || i.status === statusFilter) &&
           (classFilter === 'all' || i.driving_classes_taught === classFilter)
  })

  return (
    <>
      <style>{`
        body {
          background-color: #f8fafc;
          font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
        }
        .instructor-row { transition: all 0.2s ease; }
        .instructor-row:hover { background: #f8fafc; }
        
        .modal-overlay { 
          position: fixed; 
          inset: 0; 
          background: rgba(11, 19, 41, 0.4); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          z-index: 500; 
          backdrop-filter: blur(8px); 
          padding: 20px; 
          animation: fadeIn 0.2s ease; 
        }
        .modal-card { 
          background: white; 
          border-radius: 16px; 
          width: 100%; 
          max-width: 750px; 
          max-height: 90vh; 
          overflow-y: auto; 
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); 
          border: 1px solid #e2e8f0; 
          animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1); 
        }
        .info-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; padding: 24px; }
        @media(max-width: 680px) { .info-grid { grid-template-columns: 1fr; } }
        
        .info-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
        .info-value { font-size: 14.5px; font-weight: 600; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .schedule-card { background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; height: fit-content; }
        
        .menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 13px; font-weight: 500; cursor: pointer; color: #475569; transition: all 0.15s ease; text-align: left; }
        .menu-item:hover { background: #fff1eb; color: #ff5a00; }
        
        /* Interactive Integrated Orange Branding Colors */
        .custom-btn-secondary { 
          background: white; 
          border: 1px solid #e2e8f0; 
          padding: 10px 16px; 
          font-size: 13px; 
          font-weight: 600; 
          border-radius: 10px; 
          color: #475569; 
          cursor: pointer; 
          transition: all 0.15s ease; 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
        }
        .custom-btn-secondary:hover { border-color: #ff5a00; color: #ff5a00; background: #fff1eb; }
        
        .custom-btn-primary { 
          background: #ff5a00; 
          border: none; 
          padding: 10px 18px; 
          font-size: 13px; 
          font-weight: 600; 
          border-radius: 10px; 
          color: white; 
          cursor: pointer; 
          transition: all 0.15s ease; 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
          box-shadow: 0 4px 12px rgba(255, 90, 0, 0.15); 
        }
        .custom-btn-primary:hover { background: #e04f00; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255, 90, 0, 0.25); }
        .custom-btn-primary:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
        
        .form-control { 
          width: 100%; 
          padding: 10px 14px; 
          border-radius: 10px; 
          border: 1px solid #e2e8f0; 
          font-size: 13.5px; 
          font-weight: 500; 
          color: #1e293b; 
          background: #ffffff; 
          transition: all 0.15s ease; 
        }
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
      {viewInstructor && (
        <div className="modal-overlay" onClick={() => setViewInstructor(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Avatar name={`${viewInstructor.first_name} ${viewInstructor.surname}`} size={52} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{viewInstructor.first_name} {viewInstructor.surname}</h2>
                    <div style={{ marginTop: '4px' }}><StatusBadge status={viewInstructor.status} /></div>
                  </div>
               </div>
               <button onClick={() => setViewInstructor(null)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={16} /></button>
            </div>

            <div className="info-grid">
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', margin: '0 0 16px' }}>Instructor Profile</h3>
                
                <div className="info-label">Email Address</div>
                <div className="info-value"><Mail size={15} color="#94a3b8" /> {viewInstructor.email}</div>
                
                <div className="info-label">Phone Number</div>
                <div className="info-value"><Phone size={15} color="#94a3b8" /> {viewInstructor.phone_number || '—'}</div>
                
                <div className="info-label">Instructor Address</div>
                <div className="info-value"><MapPin size={15} color="#94a3b8" /> {viewInstructor.address || '—'}</div>

                <div className="info-label"> Teaching Class</div>
                <div className="info-value">
                   <Award size={15} color="#94a3b8" /> {viewInstructor.driving_classes_taught || 'General'}
</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                  <div>
                    <div className="info-label">Teaching Class</div>
                    <div className="info-value" style={{ margin: 0 }}><Award size={15} color="#94a3b8" /> {viewInstructor.driving_classes_taught || 'General'}</div>
                  </div>
                  <div>
                    <div className="info-label">Weekly Capacity</div>
                    <div className="info-value" style={{ color: '#ff5a00', margin: 0 }}><Zap size={15} color="#ff5a00" /> <b>{viewInstructor.workload_capacity || 0} lessons</b></div>
                  </div>
                </div>
              </div>

              <div className="schedule-card">
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0b1329', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} color="#64748b" /> Work Schedule</h3>
                {loadingLessons ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }} className="skeleton-pulse">Fetching records...</div>
                ) : instructorLessons.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                    <p style={{ fontSize: '13px', margin: 0 }}>No lessons assigned yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                    {instructorLessons.map(lesson => (
                      <div key={lesson.id} style={{ background: 'white', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{new Date(lesson.lesson_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{lesson.start_time} • {lesson.learner?.first_name}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>{lesson.status.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <form className="modal-card" style={{ maxWidth: '440px', padding: '24px' }} onClick={e => e.stopPropagation()} onSubmit={onSaveEdit}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: '#0b1329' }}>Edit Instructor Details</h3>
            
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
              <input name="ph" defaultValue={editModal.phone_number} className="form-control" placeholder="e.g. +263..." />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="info-label">Address Placement</label>
              <input name="addr" defaultValue={editModal.address} className="form-control" placeholder="Street layout details" />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="info-label">Permitted Teaching Class</label>
              <select name="cls" defaultValue={editModal.driving_classes_taught} className="form-control" style={{ cursor: 'pointer' }}>
                <option value="">Select Permitted Class</option>
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

      {/* CAPACITY MODAL */}
      {capacityModal && (
        <div className="modal-overlay" onClick={() => setCapacityModal(null)}>
          <div className="modal-card" style={{ maxWidth: '360px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0b1329' }}>Teaching Capacity</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>Set max weekly lesson volume for <b>{capacityModal.first_name}</b>.</p>
            
            <input type="number" min="0" autoFocus value={capacityInput} onChange={e => setCapacityInput(e.target.value)} style={{ width: '100%', padding: '12px', fontSize: '20px', borderRadius: '10px', border: '2px solid #e2e8f0', marginBottom: '20px', textAlign: 'center', fontWeight: '700', color: '#0b1329' }} placeholder="0" />
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCapacityModal(null)}>Cancel</button>
              <button className="custom-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onUpdateCapacity} disabled={actionLoading}>Update Capacity</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS MODAL */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-card" style={{ maxWidth: '380px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#0b1329', textTransform: 'capitalize' }}>Change Staff Status</h3>
            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 20px', lineHeight: 1.5 }}>
              Are you sure you want to proceed with executing a status shift alteration (<b>{confirmModal.type}</b>) on instructor account profile belonging to <b>{confirmModal.instructor.first_name} {confirmModal.instructor.surname}</b>?
            </p>
            
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
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '800', color: '#0b1329', letterSpacing: '-0.5px' }}>Instructors Management</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Manage teaching staff, certifications, and workload capacities</p>
        </div>

        {/* CONTROLS SECTION */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input placeholder="Search instructors via first name, surname or email..." value={search} onChange={e => setSearch(e.target.value)} className="form-control" style={{ paddingLeft: '40px', height: '42px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} />
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Filter size={14} color="#64748b" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ paddingLeft: '32px', height: '42px', width: '140px', cursor: 'pointer', background: 'white', fontSize: '13px', fontWeight: '600' }}>
                <option value="all">All Status</option>
                <option value="approved">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Deactivated</option>
              </select>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Award size={14} color="#64748b" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
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
            <div style={{ minWidth: '950px' }}>
              
              {/* Header Columns Matrix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px', padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
                <span>INSTRUCTOR IDENTIFICATION DETAILS</span>
                <span style={{ textAlign: 'center' }}>TEACHING CLASS</span>
                <span style={{ textAlign: 'center' }}>STAFF STATUS</span>
                <span style={{ textAlign: 'center' }}>LESSON CAPACITY</span>
                <span style={{ textAlign: 'center' }}>JOINED DATE</span>
                <span></span>
              </div>

              {/* Data Content Body */}
              {loading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <div style={{ padding: '50px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
                  No instructors match the current search or filter query selection matrix.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filtered.map((inst, idx) => (
                    <div key={inst.user_id} className="instructor-row" onClick={() => setViewInstructor(inst)} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px', padding: '14px 24px', alignItems: 'center', borderTop: idx !== 0 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
                      
                      {/* Column 1: Identity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <Avatar name={`${inst.first_name} ${inst.surname}`} idx={idx} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inst.first_name} {inst.surname}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{inst.email}</div>
                        </div>
                      </div>
                      
                      {/* Column 2: Driving Class */}
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', textAlign: 'center' }}>
                        {inst.driving_classes_taught ? (
                          <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>{inst.driving_classes_taught}</span>
                        ) : '—'}
                      </div>
                      
                      {/* Column 3: Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StatusBadge status={inst.status} />
                      </div>
                      
                      {/* Column 4: Slots Allocated */}
                      <div style={{ fontWeight: '700', color: '#ff5a00', fontSize: '14px', textAlign: 'center' }}>
                        {inst.workload_capacity || 0}
                      </div>
                      
                      {/* Column 5: Created At */}
                      <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500', textAlign: 'center' }}>
                        {new Date(inst.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                      
                      {/* Column 6: Action Overlay */}
                      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenu(openMenu === inst.user_id ? null : inst.user_id)} style={{ border: 'none', background: 'transparent', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                          <MoreVertical size={16} />
                        </button>
                        
                        {openMenu === inst.user_id && (
                          <div ref={menuRef} style={{ position: 'absolute', right: '100%', top: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)', zIndex: 100, width: '180px', overflow: 'hidden', marginRight: '4px' }}>
                            <button className="menu-item" onClick={() => { setViewInstructor(inst); setOpenMenu(null); }}><User size={14} /> View Record</button>
                            <button className="menu-item" onClick={() => { setEditModal(inst); setOpenMenu(null); }}><Edit3 size={14} /> Edit Details</button>
                            <button className="menu-item" onClick={() => { setCapacityModal(inst); setCapacityInput(String(inst.workload_capacity || 0)); setOpenMenu(null); }}><Zap size={14} /> Set Capacity</button>
                            
                            {inst.status === 'pending' && (
                              <button className="menu-item" style={{ color: '#16a34a' }} onClick={() => { setConfirmModal({ type: 'approve', instructor: inst }); setOpenMenu(null); }}><CheckCircle size={14} /> Approve Staff</button>
                            )}
                            
                            {inst.status === 'approved' && (
                              <button className="menu-item" style={{ color: '#dc2626' }} onClick={() => { setConfirmModal({ type: 'deactivate', instructor: inst }); setOpenMenu(null); }}><Ban size={14} /> Deactivate</button>
                            )}
                            
                            {inst.status === 'suspended' && (
                              <button className="menu-item" style={{ color: '#2563eb' }} onClick={() => { setConfirmModal({ type: 'reactivate', instructor: inst }); setOpenMenu(null); }}><RotateCcw size={14} /> Reactivate Profile</button>
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