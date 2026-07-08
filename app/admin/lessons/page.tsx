'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation' //
import React, { useState, useEffect, useCallback, useRef } from 'react'
const supabase = createClient()
import { 
  PlusCircle, 
  Layers, 
  CheckCircle, 
  Users, 
  History, 
  Edit3, 
  Trash2, 
  ChevronRight,
  Search,
  MoreVertical,
  UserPlus,
  XCircle,
  BookOpen,
  UserCog,
} from 'lucide-react' 

// ── Types ─────────────────────────────────────────────────────────────────────

type Slot = {
  slot_id: string
  slot_date: string
  slot_time: string
  status: 'available' | 'booked' | 'blocked'
}

type Booking = {
  booking_id: string
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  slot_id: string
  learner_id: string
  instructor_id?: string
  lesson_slots?: {
    slot_date: string
    slot_time: string
  }
  learner?: {
    first_name: string
    surname: string
    phone_number: string
  }
  instructor?: {
    first_name: string
    surname: string
  }
}

type User = {
  user_id: string
  first_name: string
  surname: string
  phone_number?: string
}


// ── Shared UI Helpers ─────────────────────────────────────────────────────────

function Avatar({ name, size = 32, idx = 0 }: { name: string; size?: number; idx?: number }) {
  const avatarColors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777']
  const initials = name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColors[idx % avatarColors.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700', fontSize: size * 0.35, flexShrink: 0,
    }}>{initials}</div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; dot: string; label: string }> = {
    available: { bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a', label: 'Available' },
    booked:    { bg: '#eff6ff', color: '#2563eb', dot: '#2563eb', label: 'Booked' },
    scheduled: { bg: '#eff6ff', color: '#2563eb', dot: '#2563eb', label: 'Scheduled' },
    completed: { bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a', label: 'Completed' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', dot: '#dc2626', label: 'Cancelled' },
    blocked:   { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Blocked' },
  }
  const s = map[status] ?? map.available
  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '6px', 
      padding: '4px 12px', 
      borderRadius: '9999px', 
      fontSize: '12px', 
      fontWeight: '600', 
      background: s.bg, 
      color: s.color, 
      border: `1px solid ${s.bg}` 
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function LessonsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [approvedInstructors, setApprovedInstructors] = useState<{user_id: string, first_name: string, surname: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('slots') 
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showUserEditModal, setShowUserEditModal] = useState(false)
  
  // Selection/Action Context
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form State Definitions
  const [slotDate, setSlotDate] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [bulkDates, setBulkDates] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')

  // User Edit Form State
  const [editFirstName, setEditFirstName] = useState('')
  const [editSurname, setEditSurname] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const router = useRouter()
  const menuRef = useRef<HTMLDivElement | null>(null)

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const timeSlots = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

  function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
    return (
      <div style={{
        width: w, height: h, borderRadius: r,
        background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }} />
    )
  }

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Close active dropdown overlay menu during external clicks
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

function first<T>(val: T | T[] | undefined | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] : val;
}

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Check if user is Admin
    const { data: profile } = await supabase.from('users').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'admin') { router.push('/login'); return }

    // Fetch REAL data from your tables
    const [slotsRes, bookingsRes, instRes] = await Promise.all([
      supabase.from('lesson_slots').select('*').order('slot_date', { ascending: false }),
      supabase.from('lesson_bookings').select(`
        *,
        learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname),
        lesson_slots (slot_date, slot_time)
      `).order('created_at', { ascending: false }),
      supabase.from('users').select('user_id, first_name, surname').eq('role', 'instructor').eq('status', 'approved')
    ])

    setSlots(slotsRes.data || [])
    setBookings(bookingsRes.data || [])
    setApprovedInstructors(instRes.data || [])
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  async function createSlot() {
    if (!slotDate || (!bulkDates && !slotTime)) return showToast('Please fill required fields', 'error')
    setActionLoading(true)
    try {
      if (bulkDates) {
        if (!endDate || selectedDays.length === 0) throw new Error('Provide range and days')
        const start = new Date(slotDate), end = new Date(endDate), slotsToCreate = []
        const dayMap: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayName = Object.keys(dayMap).find(k => dayMap[k] === d.getDay())
          if (dayName && selectedDays.includes(dayName)) {
            slotsToCreate.push({ slot_date: d.toISOString().split('T')[0], slot_time: slotTime, status: 'available' })
          }
        }
        const { error } = await supabase.from('lesson_slots').insert(slotsToCreate)
        if (error) throw error
        showToast(`${slotsToCreate.length} slots created`)
      } else {
        const { error } = await supabase.from('lesson_slots').insert({ slot_date: slotDate, slot_time: slotTime, status: 'available' })
        if (error) throw error
        showToast('Lesson slot created')
      }
      setShowCreateModal(false); loadData()
    } catch (err: unknown) { showToast((err as Error).message, 'error') } finally { setActionLoading(false) }
  }

  async function saveEditSlot() {
    if (!editingSlot) return
    setActionLoading(true)
    const { error } = await supabase.from('lesson_slots').update({ slot_date: editDate, slot_time: editTime }).eq('slot_id', editingSlot.slot_id)
    if (!error) { showToast('Slot updated'); setShowEditModal(false); loadData() } else showToast('Update failed', 'error')
    setActionLoading(false)
  }

  async function deleteSlot(slotId: string) {
    const { error } = await supabase.from('lesson_slots').delete().eq('slot_id', slotId)
    if (error) return showToast('Cannot delete booked slot', 'error')
    showToast('Slot deleted'); loadData()
  }

  async function cancelBooking() {
    if (!cancelReason.trim() || !selectedBooking) return showToast('Reason required', 'error')
    setActionLoading(true)
    const { error } = await supabase.from('lesson_bookings').update({ status: 'cancelled', cancellation_reason: cancelReason }).eq('booking_id', selectedBooking.booking_id)
    if (!error) {
      await supabase.from('lesson_slots').update({ status: 'available' }).eq('slot_id', selectedBooking.slot_id)
      showToast('Booking cancelled'); setShowCancelModal(false); loadData()
    }
    setActionLoading(false)
  }

  async function assignInstructor(instructorId: string) {
    if (!selectedBooking) return
    setActionLoading(true)
    const { error } = await supabase.from('lesson_bookings').update({ instructor_id: instructorId }).eq('booking_id', selectedBooking.booking_id)
    if (!error) { showToast('Instructor assigned'); setShowAssignModal(false); loadData() }
    setActionLoading(false)
  }

  async function saveUserChanges() {
    if (!editingUser || !editFirstName.trim() || !editSurname.trim()) {
      return showToast('First name and surname are required.', 'error')
    }
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: editFirstName,
          surname: editSurname,
          phone_number: editPhone,
        })
        .eq('user_id', editingUser.user_id)
      if (error) throw error
      showToast('User details updated successfully!')
      setShowUserEditModal(false)
      loadData()
    } catch (err: unknown) { showToast((err as Error).message, 'error') } finally { setActionLoading(false) }
  }

  const computedSlots = slots.map(slot => ({
    ...slot,
    actual_status: bookings.some(b => b.slot_id === slot.slot_id && b.status !== 'cancelled') ? 'booked' : slot.status
  }))

  const filteredSlots = computedSlots.filter(s => s.slot_date?.includes(search) && (filterStatus === 'all' || s.actual_status === filterStatus))
const filteredBookings = bookings.filter(b => {
    const learnerData = first(b.learner);
    const firstName = learnerData?.first_name || '';
    const surname = learnerData?.surname || '';
    const name = `${firstName} ${surname}`.toLowerCase();
    return name.includes(search.toLowerCase()) && (filterStatus === 'all' || b.status === filterStatus);
  });

  const stats = [
    { label: 'Total Capacity', val: computedSlots.length, icon: <Layers size={18} color="#6366f1" />, bg: '#eef2ff' },
    { label: 'Available Slots', val: computedSlots.filter(s => s.actual_status === 'available').length, icon: <CheckCircle size={18} color="#10b981" />, bg: '#f0fdf4' },
    { label: 'Active Bookings', val: computedSlots.filter(s => s.actual_status === 'booked').length, icon: <Users size={18} color="#2563eb" />, bg: '#eff6ff' },
    { label: 'Total History', val: bookings.length, icon: <History size={18} color="#ff5a00" />, bg: '#fff2eb' }
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .row-hover { transition: background 0.15s ease; }
        .row-hover:hover { background: #f8fafc; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(4px); padding: 20px; }
        .modal-card { background: white; border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); padding: 30px; }
        .kpi-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease; cursor: default; }
        .kpi-card:hover { border-color: #ff5a00; transform: translateY(-2px); }
        .info-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; display: block; }
        .dashboard-control { height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; font-size: 14px; color: #1e293b; font-weight: 500; outline: none; transition: all 0.2s ease; }
        .dashboard-control:focus { border-color: #ff5a00; box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.1); }
        
        .tab-btn { padding: 10px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.15s ease; }
        
        .custom-btn-primary { 
          background: #ff5a00; 
          border: none; 
          padding: 11px 20px; 
          font-size: 13px; 
          font-weight: 700; 
          border-radius: 12px; 
          color: white; 
          cursor: pointer; 
          transition: all 0.15s ease; 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
          box-shadow: 0 4px 12px rgba(255, 90, 0, 0.15); 
        }
        .custom-btn-primary:hover { background: #e04f00; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255, 90, 0, 0.25); }
        
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

        .menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 14px; border: none; background: none; font-size: 13.5px; font-weight: 600; cursor: pointer; color: #475569; transition: all 0.15s ease; text-align: left; }
        .menu-item:hover { background: #fff1eb; color: #ff5a00; }
      `}</style>

      {/* TOAST ALERTS OVERLAY */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, padding: '14px 24px', borderRadius: '12px', background: toast.type === 'success' ? '#0b1329' : '#dc2626', color: 'white', fontWeight: '600', fontSize: '13.5px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {toast.type === 'error' ? <XCircle size={16} color="#ff8a8a" /> : <CheckCircle size={16} color="#4ade80" />}
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header Block Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.5px' }}>Lessons Management</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Configure scheduling availability and manage active bookings</p>
          </div>
          {/* Create Slot Button consistent with the Learner flow style */}
          <button onClick={() => setShowCreateModal(true)} className="custom-btn-primary">
            <PlusCircle size={18} /> Create Slot
          </button>
        </div>

        {/* KPI Cards Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
          {loading ? (
             Array(4).fill(0).map((_, i) => (
                <div key={i} className="kpi-card">
                  <div><Skeleton w="80px" h="12px" /><div style={{ marginTop: '8px' }}><Skeleton w="50px" h="28px" /></div></div>
                  <Skeleton w="42px" h="42px" r="12px" />
                </div>
             ))
          ) : (
            stats.map((s, i) => (
              <div key={i} className="kpi-card">
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{s.val}</p>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.icon}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Search, Filter, and Tab Change Section */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          
          {/* Tabs Switch Button Styled Consistency like the command suite section */}
          <div style={{ background: '#f1f5f9', padding: '5.5px', borderRadius: '12px', display: 'flex', gap: '6px', border: '1px solid #e2e8f0' }}>
            <button 
              className="tab-btn" 
              onClick={() => { setActiveTab('slots'); setFilterStatus('all'); }} 
              style={{ 
                background: activeTab === 'slots' ? '#fff1eb' : 'transparent', 
                color: activeTab === 'slots' ? '#ff5a00' : '#64748b', 
                boxShadow: activeTab === 'slots' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Lesson Slots
            </button>
            <button 
              className="tab-btn" 
              onClick={() => { setActiveTab('bookings'); setFilterStatus('all'); }} 
              style={{ 
                background: activeTab === 'bookings' ? '#fff1eb' : 'transparent', 
                color: activeTab === 'bookings' ? '#ff5a00' : '#64748b', 
                boxShadow: activeTab === 'bookings' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              All Bookings
            </button>
          </div>

          {/* Search Box */}
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              placeholder={activeTab === 'slots' ? "Search date (YYYY-MM-DD)..." : "Search student name..."} 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="dashboard-control" 
              style={{ width: '100%', paddingLeft: '40px' }} 
            />
          </div>
          
          {/* Styled ALL Status Filter matched exactly element by element to Learner Page */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <BookOpen size={14} color="#64748b" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              className="dashboard-control" 
              style={{ paddingLeft: '32px', width: '170px', cursor: 'pointer', background: 'white', fontSize: '13px', fontWeight: '600' }}
            >
              <option value="all">All Statuses</option>
              {activeTab === 'slots' 
                ? ['available', 'booked', 'blocked'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>) 
                : ['scheduled', 'completed', 'cancelled'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)
              }
            </select>
          </div>

        </div>

        {/* Data Interactive Grid */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          {activeTab === 'slots' ? (
            <div style={{ minWidth: '800px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 120px', padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
                <span style={{ textAlign: 'left' }}>SLOT DATE</span>
                <span style={{ textAlign: 'center' }}>START TIME</span>
                <span style={{ textAlign: 'center' }}>CURRENT STATUS</span>
                <span style={{ textAlign: 'center' }}>ACTIONS</span>
              </div>
              {loading ? (
                <div style={{ padding: '40px' }}><Skeleton h="120px" /></div>
              ) : filteredSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '13.5px', fontWeight: '500' }}>No slots found.</div>
              ) : filteredSlots.map(slot => (
                <div key={slot.slot_id} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 120px', padding: '16px 24px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', textAlign: 'left' }}>{new Date(slot.slot_date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <span style={{ fontWeight: '600', color: '#64748b', textAlign: 'center' }}>{slot.slot_time.slice(0, 5)}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><StatusBadge status={slot.actual_status} /></div>
                  
                  {/* Action Drodown Dots Context Menu for slots, matching how it looks when its on all booking */}
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => setOpenMenu(openMenu === slot.slot_id ? null : slot.slot_id)} 
                      style={{ 
                        border: 'none', 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: openMenu === slot.slot_id ? '#ff5a00' : '#94a3b8',
                        background: openMenu === slot.slot_id ? '#fff1eb' : 'transparent',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { if (openMenu !== slot.slot_id) e.currentTarget.style.background = '#f1f5f9' }}
                      onMouseLeave={e => { if (openMenu !== slot.slot_id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {openMenu === slot.slot_id && (
                      <div 
                        ref={menuRef} 
                        style={{ 
                          position: 'absolute', 
                          right: '100%', 
                          top: '0', 
                          background: 'white', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '12px', 
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03)', 
                          zIndex: 100, 
                          width: '180px', 
                          overflow: 'hidden', 
                          marginRight: '8px' 
                        }}
                      >
                        {slot.actual_status === 'available' ? (
                          <>
                            <button 
                              className="menu-item" 
                              onClick={() => { setEditingSlot(slot); setEditDate(slot.slot_date); setEditTime(slot.slot_time); setShowEditModal(true); setOpenMenu(null); }}
                            >
                              <Edit3 size={14} color="#2563eb" /> Edit Slot
                            </button>
                            <button 
                              className="menu-item" 
                              style={{ color: '#dc2626' }} 
                              onClick={() => { deleteSlot(slot.slot_id); setOpenMenu(null); }}
                            >
                              <Trash2 size={14} color="#dc2626" /> Delete Slot
                            </button>
                          </>
                        ) : (
                          <div style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8', fontWeight: '500', textAlign: 'center' }}>
                            No actions active
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ minWidth: '1000px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 150px', padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
                <span style={{ textAlign: 'left' }}>LEARNER</span>
                <span style={{ textAlign: 'left' }}>INSTRUCTOR</span>
                <span style={{ textAlign: 'center' }}>SCHEDULE</span>
                <span style={{ textAlign: 'center' }}>STATUS</span>
                <span style={{ textAlign: 'center' }}>ACTIONS</span>
              </div>
              {loading ? (
                <div style={{ padding: '40px' }}><Skeleton h="120px" /></div>
              ) : filteredBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '13.5px', fontWeight: '500' }}>No bookings found.</div>
              ) : filteredBookings.map((b, idx) => {
  // Extract real data for this specific row
  const learner = first(b.learner);
  const instructor = first(b.instructor);
  const slot = first(b.lesson_slots);

  return (
    <div key={b.booking_id} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 150px', padding: '16px 24px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
        {/* Use Real Name for Avatar and Display */}
        <Avatar name={`${learner?.first_name || 'U'} ${learner?.surname || ''}`} idx={idx} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
            {learner?.first_name} {learner?.surname}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {learner?.phone_number}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: instructor ? '#1e293b' : '#94a3b8', justifyContent: 'flex-start' }}>
        {instructor ? <>{instructor.first_name} {instructor.surname}</> : <span>Unassigned</span>}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
          {slot?.slot_date ? new Date(slot.slot_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '---'}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          {slot?.slot_time?.slice(0, 5) || '--:--'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <StatusBadge status={b.status} />
      </div>
      
      {/* Action Dots Menu */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={() => setOpenMenu(openMenu === b.booking_id ? null : b.booking_id)} 
          style={{ border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: openMenu === b.booking_id ? '#ff5a00' : '#94a3b8', background: openMenu === b.booking_id ? '#fff1eb' : 'transparent', transition: 'all 0.15s ease' }}
        >
          <MoreVertical size={16} />
        </button>
        
        {openMenu === b.booking_id && (
          <div ref={menuRef} style={{ position: 'absolute', right: '100%', top: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03)', zIndex: 100, width: '180px', overflow: 'hidden', marginRight: '8px' }}>
            {b.status === 'scheduled' ? (
              <>
                <button className="menu-item" onClick={() => { setSelectedBooking(b); setShowAssignModal(true); setOpenMenu(null); }}>
                  <UserPlus size={14} color="#2563eb" /> Assign Instructor
                </button>
                <button className="menu-item" onClick={() => {
                  if (learner) { setEditingUser({ ...learner, user_id: b.learner_id }); setEditFirstName(learner.first_name); setEditSurname(learner.surname); setEditPhone(learner.phone_number || ''); setShowUserEditModal(true); setOpenMenu(null); }
                }}>
                  <UserCog size={14} color="#f97316" /> Edit Learner
                </button>
                <button className="menu-item" style={{ color: '#dc2626' }} onClick={() => { setSelectedBooking(b); setShowCancelModal(true); setOpenMenu(null); }}>
                  <XCircle size={14} color="#dc2626" /> Cancel Booking
                </button>
              </>
            ) : (
              <div style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8', fontWeight: '500', textAlign: 'center' }}>
                No actions active
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
})}
            </div>
          )}
        </div>
      </div>

      {/* CREATE SLOT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: '800' }}>Create Lesson Slot</h2>
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <div>
                 <div style={{ fontWeight: '800', fontSize: '13px' }}>Bulk Creation</div>
                 <div style={{ fontSize: '11px', color: '#64748b' }}>Generate slots for a date range</div>
               </div>
               <input type="checkbox" checked={bulkDates} onChange={e => setBulkDates(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#ff5a00' }} />
            </div>
            <label className="info-label">{bulkDates ? 'Start Date' : 'Date'}</label>
            <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} className="dashboard-control" style={{ marginBottom: '15px', width: '100%' }} />
            {bulkDates && (
              <>
                <label className="info-label">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="dashboard-control" style={{ marginBottom: '15px', width: '100%' }} />
                <label className="info-label">Select Days</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                  {weekDays.map(d => (
                    <button key={d} onClick={() => setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #ddd', fontSize: '11px', fontWeight: '700', background: selectedDays.includes(d) ? '#1e293b' : 'white', color: selectedDays.includes(d) ? 'white' : '#64748b', cursor: 'pointer' }}>{d.slice(0, 3)}</button>
                  ))}
                </div>
              </>
            )}
            <label className="info-label">Select Time</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '25px' }}>
              {timeSlots.map(t => (
                <button key={t} onClick={() => setSlotTime(t + ':00')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '700', background: slotTime === t + ':00' ? '#ff5a00' : 'white', color: slotTime === t + ':00' ? 'white' : '#1e293b', cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={createSlot} disabled={actionLoading} className="custom-btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {actionLoading ? 'Creating...' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SLOT MODAL */}
      {showEditModal && editingSlot && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: '800' }}>Edit Slot</h2>
            <label className="info-label">Date</label>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="dashboard-control" style={{ marginBottom: '15px', width: '100%' }} />
            <label className="info-label">Time</label>
            <select value={editTime} onChange={e => setEditTime(e.target.value)} className="dashboard-control" style={{ marginBottom: '25px', width: '100%' }}>
              {timeSlots.map(t => <option key={t} value={t + ':00'}>{t}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowEditModal(false)} className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={saveEditSlot} disabled={actionLoading} className="custom-btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 style={{ margin: '0 0 5px', fontSize: '20px', fontWeight: '800' }}>Assign Instructor</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Select instructor for {selectedBooking.learner?.first_name || 'James'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {approvedInstructors.map(inst => (
                <button key={inst.user_id} onClick={() => assignInstructor(inst.user_id)} style={{ padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', textAlign: 'left', cursor: 'pointer', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {inst.first_name} {inst.surname}
                  <ChevronRight size={18} color="#cbd5e1" />
                </button>
              ))}
            </div>
            <button onClick={() => setShowAssignModal(false)} className="custom-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: '800' }}>Cancel Booking</h2>
            <p style={{ marginBottom: '20px', fontSize: '14px', color: '#64748b' }}>Provide a reason for cancelling this lesson. The student will be notified.</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." rows={4} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', marginBottom: '20px', outline: 'none', fontFamily: 'inherit', fontSize: '14px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCancelModal(false)} className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Go Back</button>
              <button onClick={cancelBooking} disabled={actionLoading} className="custom-btn-primary" style={{ flex: 2, justifyContent: 'center', background: '#dc2626', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)' }} onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'} onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}>
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showUserEditModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <UserCog size={20} color="#f97316" />
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Edit User Details</h2>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
              Editing profile for: <strong style={{ color: '#1e293b' }}>{editingUser.first_name} {editingUser.surname}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label className="info-label">First Name</label>
                <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className="dashboard-control" style={{ width: '100%' }} />
              </div>
              <div>
                <label className="info-label">Surname</label>
                <input type="text" value={editSurname} onChange={e => setEditSurname(e.target.value)} className="dashboard-control" style={{ width: '100%' }} />
              </div>
              <div>
                <label className="info-label">Phone Number</label>
                <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="dashboard-control" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowUserEditModal(false)} className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={saveUserChanges} disabled={actionLoading} className="custom-btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}