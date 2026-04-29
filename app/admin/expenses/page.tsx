'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Vehicle {
  vehicle_id: string
  registration_number: string
  make: string
  model: string
  status?: string // 'available', 'maintenance'
  maintenance_start_date?: string | null
  maintenance_end_date?: string | null
}

interface Expense {
  expense_id: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  recorded_by: string
  vehicle_id?: string | null
}

// ── Skeleton Loader (Matching AdminDashboard) ────────────
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

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'vehicles' | 'vehicle_details'>('all')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  
  const [recording, setRecording] = useState(false)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)

  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Expense Form fields
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseVehicleId, setExpenseVehicleId] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])

  // Vehicle Form fields
  const [vRegNumber, setVRegNumber] = useState('')
  const [vMake, setVMake] = useState('')
  const [vModel, setVModel] = useState('')
  const [vStatus, setVStatus] = useState('available')
  const [vStartDate, setVStartDate] = useState('')
  const [vEndDate, setVEndDate] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // Design tokens aligned with AdminDashboard
  const textDark = '#1e293b'
  const textBody = '#64748b'
  const textMuted = '#94a3b8'
  const orange = '#e8731a'
  const danger = '#ef4444'
  const success = '#10b981'
  const primary = '#3b82f6'

  // Category splits
  const vehicleCategories = [
    { id: 'fuel', label: 'Fuel', icon: '⛽' },
    { id: 'vehicle_maintenance', label: 'Maintenance', icon: '🔧' },
    { id: 'zinara', label: 'ZINARA', icon: '🎫' },
    { id: 'other', label: 'Other', icon: '📦' },
  ]
  const generalCategories = [
    { id: 'office_supplies', label: 'Office Supplies', icon: '📎' },
    { id: 'utilities', label: 'Utilities', icon: '💡' },
    { id: 'other', label: 'Other', icon: '📦' },
  ]
  const allCategories = [
    { id: 'fuel', label: 'Fuel', icon: '⛽' },
    { id: 'vehicle_maintenance', label: 'Maintenance', icon: '🔧' },
    { id: 'zinara', label: 'ZINARA', icon: '🎫' },
    { id: 'office_supplies', label: 'Office Supplies', icon: '📎' },
    { id: 'utilities', label: 'Utilities', icon: '💡' },
    { id: 'other', label: 'Other', icon: '📦' },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: vData, error: vError } = await supabase.from('vehicles').select('*').order('registration_number')
    if (!vError && vData) setVehicles(vData)

    const { data: eData } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      
    setExpenses(eData || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      
      const { data } = await supabase.from('users').select('role').eq('user_id', user.id).single()
      if (data?.role !== 'admin') { router.push('/login'); return }
      
      await loadData()
    }
    init()
  }, [router, supabase, loadData])

  // ── Expenses Logic
  async function recordExpense() {
    if (!category || !amount || !expenseDate) { setError('Please fill in all required fields.'); return }
    if (parseFloat(amount) <= 0) { setError('Amount must be greater than zero.'); return }
    setRecording(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('expenses').insert({
        category,
        amount: parseFloat(amount),
        description: description || null,
        expense_date: expenseDate,
        recorded_by: user?.id,
        vehicle_id: expenseVehicleId || null,
      })

    if (insertError) { setError('Failed to record expense.'); setRecording(false); return }

    setSuccessMessage(`Expense of $${parseFloat(amount).toFixed(2)} recorded successfully.`)
    setTimeout(() => setSuccessMessage(''), 3000)
    
    setShowModal(false); setCategory(''); setAmount(''); setDescription(''); setExpenseDate(new Date().toISOString().split('T')[0]); setRecording(false)
    loadData()
  }

  async function deleteExpense(expenseId: string) {
    if (!confirm('Are you sure you want to delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('expense_id', expenseId)
    if (error) { setError('Failed to delete expense.'); setTimeout(() => setError(''), 3000); return }
    setSuccessMessage('Expense deleted.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadData()
  }

  // ── Vehicle Logic
  function openAddVehicle() {
    setEditingVehicle(null)
    setVRegNumber(''); setVMake(''); setVModel(''); setVStatus('available'); setVStartDate(''); setVEndDate('')
    setShowVehicleModal(true); setError('')
  }

  function openEditVehicle(v: Vehicle) {
    setEditingVehicle(v)
    setVRegNumber(v.registration_number); setVMake(v.make); setVModel(v.model)
    setVStatus(v.status || 'available'); setVStartDate(v.maintenance_start_date || ''); setVEndDate(v.maintenance_end_date || '')
    setShowVehicleModal(true); setError('')
  }

  async function saveVehicle() {
    if (!vRegNumber || !vMake || !vModel) { setError('Please fill in all required vehicle details.'); return; }
    if (vStatus === 'maintenance' && (!vStartDate || !vEndDate)) { setError('Please provide start and end dates for maintenance.'); return; }
    
    setAddingVehicle(true); setError('')

    const payload = {
      registration_number: vRegNumber, make: vMake, model: vModel, status: vStatus,
      maintenance_start_date: vStatus === 'maintenance' ? vStartDate : null,
      maintenance_end_date: vStatus === 'maintenance' ? vEndDate : null
    }

    if (editingVehicle) {
      const { error: updateError } = await supabase.from('vehicles').update(payload).eq('vehicle_id', editingVehicle.vehicle_id)
      if (updateError) { setError('Failed to update vehicle: ' + updateError.message); setAddingVehicle(false); return }
      setSuccessMessage('Vehicle updated successfully.')
    } else {
      const { error: insertError } = await supabase.from('vehicles').insert(payload)
      if (insertError) { setError('Failed to add vehicle: ' + insertError.message); setAddingVehicle(false); return }
      setSuccessMessage(`Vehicle ${vRegNumber} added successfully.`)
    }

    setTimeout(() => setSuccessMessage(''), 3000)
    setShowVehicleModal(false); setEditingVehicle(null); setAddingVehicle(false)
    loadData()
  }

  async function deleteVehicle(id: string) {
    if (!confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) return
    const { error } = await supabase.from('vehicles').delete().eq('vehicle_id', id)
    if (error) { setError('Failed to delete vehicle.'); return }
    setSuccessMessage('Vehicle deleted.')
    setTimeout(() => setSuccessMessage(''), 3000)
    
    if (activeTab === 'vehicle_details' && selectedVehicle?.vehicle_id === id) {
      setActiveTab('vehicles'); setSelectedVehicle(null)
    }
    loadData()
  }

  // ── Helpers
  function getVehicleReg(vId?: string | null) {
    if (!vId) return ''
    const v = vehicles.find(v => v.vehicle_id === vId)
    return v ? `${v.registration_number} (${v.make} ${v.model})` : ''
  }

  function getCategoryIcon(cat: string) { return allCategories.find(c => c.id === cat)?.icon || '📦' }
  function getCategoryLabel(cat: string) { return allCategories.find(c => c.id === cat)?.label || cat }

  // ── Filters & Totals
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase()) || getVehicleReg(e.vehicle_id)?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterCategory === 'all' || e.category === filterCategory
    const matchesVehicleTab = activeTab !== 'vehicle_details' || e.vehicle_id === selectedVehicle?.vehicle_id
    return matchesSearch && matchesFilter && matchesVehicleTab
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const thisMonthExpenses = expenses.filter(e => {
      const expDate = new Date(e.expense_date)
      const now = new Date()
      return (expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear())
    }).reduce((sum, e) => sum + Number(e.amount), 0)

  const currentFormCategories = expenseVehicleId ? vehicleCategories : generalCategories
  const currentFilterCategories = activeTab === 'vehicle_details' ? vehicleCategories : allCategories
  const monthName = new Date().toLocaleString('en-GB', { month: 'short' })

  // Removed the global `if (loading) return <div>` to allow inline skeletons instead

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: '0 0 6px' }}>🧾 Expenses & Vehicles</h1>
            <p style={{ color: textBody, fontSize: '13px', margin: 0 }}>Record and track all school expenses</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {activeTab === 'vehicles' && (
              <button
                onClick={openAddVehicle}
                style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${textBody}`, background: 'white', color: textDark, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                + Add Vehicle
              </button>
            )}
            <button
              onClick={() => { setExpenseVehicleId(''); setCategory(''); setShowModal(true); setError('') }}
              style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: success, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              + Record Expense
            </button>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMessage && <div style={{ background: '#dcfce7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>✅ {successMessage}</div>}
        {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>❌ {error}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '10px', padding: '4px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', width: 'fit-content' }}>
          {[{ id: 'all', label: '🧾 All Expenses' }, { id: 'vehicles', label: '🚗 Vehicle Fleet' }].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as 'all' | 'vehicles'); setSelectedVehicle(null); setFilterCategory('all') }} 
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === tab.id ? textDark : 'transparent', color: activeTab === tab.id ? 'white' : textBody, fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── VEHICLE FLEET TAB (HORIZONTAL VIEW) ── */}
        {activeTab === 'vehicles' && (
          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 3fr', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              {['Vehicle', 'Status', 'Total Spent', 'Maintenance Dates', 'Actions'].map((h, i) => (
                <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{h}</p>
              ))}
            </div>
            
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 3fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', gap: '16px' }}>
                  <div><Skeleton h="14px" w="120px" r="4px" /><div style={{ marginTop: '6px' }}><Skeleton h="11px" w="80px" r="4px" /></div></div>
                  <div><Skeleton w="70px" h="20px" r="12px" /></div>
                  <Skeleton w="50px" h="14px" r="4px" />
                  <Skeleton w="100px" h="12px" r="4px" />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Skeleton w="55px" h="24px" r="6px" />
                    <Skeleton w="65px" h="24px" r="6px" />
                    <Skeleton w="45px" h="24px" r="6px" />
                    <Skeleton w="50px" h="24px" r="6px" />
                  </div>
                </div>
              ))
            ) : vehicles.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', marginBottom: '12px' }}>🚗</p>
                <p style={{ color: textBody, fontSize: '14px', fontWeight: '500' }}>No vehicles found. Add one to get started.</p>
              </div>
            ) : (
              vehicles.map(v => {
                const vTotal = expenses.filter(e => e.vehicle_id === v.vehicle_id).reduce((sum, e) => sum + Number(e.amount), 0)
                const isMaintenance = v.status === 'maintenance'
                
                return (
                  <div key={v.vehicle_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 3fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: textDark }}>{v.registration_number}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: textBody }}>{v.make} {v.model}</p>
                    </div>
                    <div>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: isMaintenance ? '#fff5f5' : '#dcfce7', color: isMaintenance ? '#ea580c' : '#16a34a' }}>
                        {isMaintenance ? 'Maintenance' : 'Available'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: textDark }}>${vTotal.toFixed(2)}</p>
                    <div>
                      {isMaintenance && v.maintenance_start_date && v.maintenance_end_date ? (
                        <p style={{ margin: 0, fontSize: '12px', color: textBody, fontWeight: '500' }}>
                          {new Date(v.maintenance_start_date).toLocaleDateString()} - {new Date(v.maintenance_end_date).toLocaleDateString()}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>—</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button onClick={() => { setSelectedVehicle(v); setActiveTab('vehicle_details'); setFilterCategory('all'); setSearch('') }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>View Exp.</button>
                      <button onClick={() => { setExpenseVehicleId(v.vehicle_id); setCategory('fuel'); setShowModal(true); setError('') }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ Expense</button>
                      <button onClick={() => openEditVehicle(v)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteVehicle(v.vehicle_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff5f5', color: '#dc2626', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── VEHICLE DETAILS VIEW ── */}
        {activeTab === 'vehicle_details' && selectedVehicle && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => { setActiveTab('vehicles'); setSelectedVehicle(null); setFilterCategory('all') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                ← Back to Fleet
              </button>
              <h2 style={{ margin: 0, color: textDark, fontSize: '20px', fontWeight: '800' }}>
                {selectedVehicle.registration_number} <span style={{ color: textBody, fontWeight: '500', fontSize: '16px' }}>({selectedVehicle.make} {selectedVehicle.model})</span>
              </h2>
            </div>

            {/* Vehicle Specific Stats Block (AdminDashboard Style) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <Skeleton h="11px" w="55%" r="4px" />
                    <div style={{ margin: '10px 0 8px' }}><Skeleton h="30px" w="45%" r="5px" /></div>
                    <Skeleton h="11px" w="65%" r="4px" />
                  </div>
                ))
              ) : (
                [
                  { label: 'total spent', value: `$${filteredExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`, sub: 'all records', accent: danger },
                  { label: 'fuel costs', value: `$${filteredExpenses.filter(e => e.category === 'fuel').reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`, sub: 'total fuel', accent: success },
                  { label: 'maintenance costs', value: `$${filteredExpenses.filter(e => e.category === 'vehicle_maintenance').reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`, sub: 'total maintenance', accent: orange },
                  { label: 'total records', value: filteredExpenses.length, sub: 'tracked entries', accent: primary },
                ].map((card, i) => (
                  <div key={i} 
                       onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)' }}
                       onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                       style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', borderLeft: `3px solid ${card.accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.15s, box-shadow 0.15s' }}>
                    <p style={{ margin: '0 0 6px', fontSize: '11px', color: textMuted, fontWeight: '500', textTransform: 'lowercase' }}>{card.label}</p>
                    <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>{card.value}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: card.accent, fontWeight: '500' }}>{card.sub}</p>
                  </div>
                ))
              )}
            </div>
            
            <button onClick={() => { 
                setExpenseVehicleId(selectedVehicle.vehicle_id)
                setCategory('fuel') 
                setShowModal(true)
                setError('')
              }} 
              style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', background: success, color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}
            >
              <span>+</span> Record Expense for {selectedVehicle.registration_number}
            </button>
          </div>
        )}

        {/* ── EXPENSES LIST (Shown for 'all' and 'vehicle_details') ── */}
        {(activeTab === 'all' || activeTab === 'vehicle_details') && (
          <>
            {/* Main Stats Row (AdminDashboard Style) */}
            {activeTab === 'all' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <Skeleton h="11px" w="55%" r="4px" />
                      <div style={{ margin: '10px 0 8px' }}><Skeleton h="30px" w="45%" r="5px" /></div>
                      <Skeleton h="11px" w="65%" r="4px" />
                    </div>
                  ))
                ) : (
                  [
                    { label: 'total expenses', value: `$${totalExpenses.toFixed(2)}`, sub: 'all time spent', accent: danger },
                    { label: `expenses (${monthName})`, value: `$${thisMonthExpenses.toFixed(2)}`, sub: 'current period', accent: orange },
                    { label: 'total records', value: expenses.length, sub: 'tracked entries', accent: primary },
                    { label: 'fuel', value: `$${expenses.filter(e => e.category === 'fuel').reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`, sub: 'total spent', accent: success },
                  ].map((card, i) => (
                    <div key={i} 
                         onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)' }}
                         onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                         style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', borderLeft: `3px solid ${card.accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.15s, box-shadow 0.15s' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', color: textMuted, fontWeight: '500', textTransform: 'lowercase' }}>{card.label}</p>
                      <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>{card.value}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: card.accent, fontWeight: '500' }}>{card.sub}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Expenses Table */}
            <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              
              {/* Search and Filter */}
              <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="🔍 Search descriptions or plates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setFilterCategory('all')}
                    style={{ padding: '6px 14px', borderRadius: '20px', border: filterCategory === 'all' ? 'none' : '1px solid #e2e8f0', background: filterCategory === 'all' ? textDark : 'white', color: filterCategory === 'all' ? 'white' : textBody, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    All
                  </button>
                  {currentFilterCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setFilterCategory(cat.id)}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: filterCategory === cat.id ? 'none' : '1px solid #e2e8f0', background: filterCategory === cat.id ? textDark : 'white', color: filterCategory === cat.id ? 'white' : textBody, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Header */}
              <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'vehicle_details' ? '1.5fr 1fr 2fr 1fr 1fr' : '1.5fr 1.5fr 1fr 2fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                {(activeTab === 'vehicle_details' ? ['Category', 'Amount', 'Description', 'Date', 'Actions'] : ['Category', 'Linked Vehicle', 'Amount', 'Description', 'Date', 'Actions']).map((h, i) => (
                  <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{h}</p>
                ))}
              </div>

              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: activeTab === 'vehicle_details' ? '1.5fr 1fr 2fr 1fr 1fr' : '1.5fr 1.5fr 1fr 2fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Skeleton w="24px" h="24px" r="4px" /><Skeleton w="80px" h="13px" r="4px" /></div>
                    {activeTab !== 'vehicle_details' && <div><Skeleton w="70px" h="20px" r="6px" /></div>}
                    <Skeleton w="40px" h="14px" r="4px" />
                    <Skeleton w="120px" h="13px" r="4px" />
                    <Skeleton w="70px" h="12px" r="4px" />
                    <Skeleton w="55px" h="24px" r="6px" />
                  </div>
                ))
              ) : filteredExpenses.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '32px', marginBottom: '12px' }}>🧾</p>
                  <p style={{ color: textBody, fontSize: '14px', fontWeight: '500' }}>No expenses found</p>
                </div>
              ) : (
                filteredExpenses.map((expense) => (
                  <div key={expense.expense_id} style={{ display: 'grid', gridTemplateColumns: activeTab === 'vehicle_details' ? '1.5fr 1fr 2fr 1fr 1fr' : '1.5fr 1.5fr 1fr 2fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    
                    {/* Category */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{getCategoryIcon(expense.category)}</span>
                      <span style={{ fontSize: '13px', color: textDark, fontWeight: '600' }}>{getCategoryLabel(expense.category)}</span>
                    </div>

                    {/* Vehicle Tag */}
                    {activeTab !== 'vehicle_details' && (
                      <div>
                        {expense.vehicle_id ? (
                          <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: textDark, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                            🚗 {getVehicleReg(expense.vehicle_id)}
                          </span>
                        ) : (
                          <span style={{ color: textBody, fontSize: '12px', fontWeight: '500' }}>General</span>
                        )}
                      </div>
                    )}

                    {/* Amount */}
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: textDark }}>${Number(expense.amount).toFixed(2)}</p>

                    {/* Description */}
                    <p style={{ margin: 0, fontSize: '13px', color: textBody }}>{expense.description || '—'}</p>

                    {/* Date */}
                    <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </p>

                    {/* Actions */}
                    <button onClick={() => deleteExpense(expense.expense_id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff5f5', color: danger, fontSize: '11px', fontWeight: '600', cursor: 'pointer', width: 'fit-content' }}>
                      Delete
                    </button>
                  </div>
                ))
              )}

              {/* Table Footer Total */}
              {!loading && filteredExpenses.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'vehicle_details' ? '1.5fr 1fr 2fr 1fr 1fr' : '1.5fr 1.5fr 1fr 2fr 1fr 1fr', padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL VISIBLE</p>
                  {activeTab !== 'vehicle_details' && <p style={{ margin: 0 }} />}
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: textDark }}>
                    ${filteredExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}
                  </p>
                  <p style={{ margin: 0 }} /><p style={{ margin: 0 }} /><p style={{ margin: 0 }} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── RECORD EXPENSE MODAL (AdminDashboard Style) ── */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: textDark }}>
                {expenseVehicleId ? 'Record Vehicle Expense' : 'Record General Expense'}
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: textBody }}>
                {expenseVehicleId ? (
                  <>Recording expense for <strong>{getVehicleReg(expenseVehicleId)}</strong>.</>
                ) : (
                  <>Recording a general expense for the school.</>
                )}
              </p>

              {error && (
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: '8px' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Category *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {currentFormCategories.map(cat => (
                      <button
                        key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                        style={{
                          padding: '10px 12px', borderRadius: '8px',
                          border: category === cat.id ? '1.5px solid #1e293b' : '1px solid #e2e8f0',
                          background: category === cat.id ? '#f8fafc' : 'white',
                          color: textDark,
                          fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <span>{cat.icon}</span><span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Amount ($) *</label>
                    <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '16px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date *</label>
                    <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Notes (optional)</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Details about the expense" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: '500', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowModal(false); setCategory(''); setAmount(''); setDescription(''); setExpenseDate(new Date().toISOString().split('T')[0]); setError('') }}
                  style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textBody, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={recordExpense} disabled={recording}
                  style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: recording ? '#94a3b8' : success, color: 'white', fontSize: '13px', fontWeight: '700', cursor: recording ? 'not-allowed' : 'pointer' }}
                >
                  {recording ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ADD / EDIT VEHICLE MODAL (AdminDashboard Style) ── */}
        {showVehicleModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: textDark }}>
                {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: textBody }}>
                Fill in the details for the school vehicle fleet.
              </p>
              
              {error && (
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: '8px' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Registration Number *</label>
                  <input type="text" value={vRegNumber} onChange={(e) => setVRegNumber(e.target.value.toUpperCase())} placeholder="e.g. AFK 1234" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '16px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Make *</label>
                    <input type="text" value={vMake} onChange={(e) => setVMake(e.target.value)} placeholder="e.g. Honda" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: '500', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Model *</label>
                    <input type="text" value={vModel} onChange={(e) => setVModel(e.target.value)} placeholder="e.g. Fit" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: '500', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: textDark, marginBottom: '10px' }}>Vehicle Status</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button type="button" onClick={() => setVStatus('available')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: vStatus === 'available' ? 'none' : '1px solid #e2e8f0', background: vStatus === 'available' ? success : 'white', color: vStatus === 'available' ? 'white' : textBody, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Available</button>
                    <button type="button" onClick={() => setVStatus('maintenance')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: vStatus === 'maintenance' ? 'none' : '1px solid #e2e8f0', background: vStatus === 'maintenance' ? danger : 'white', color: vStatus === 'maintenance' ? 'white' : textBody, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>In Maintenance</button>
                  </div>
                  
                  {vStatus === 'maintenance' && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: textBody, marginBottom: '4px' }}>Start Date *</label>
                        <input type="date" value={vStartDate} onChange={(e) => setVStartDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: textBody, marginBottom: '4px' }}>End Date *</label>
                        <input type="date" value={vEndDate} onChange={(e) => setVEndDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowVehicleModal(false); setEditingVehicle(null); setError('') }} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textBody, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveVehicle} disabled={addingVehicle} style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: addingVehicle ? '#94a3b8' : textDark, color: 'white', fontSize: '13px', fontWeight: '700', cursor: addingVehicle ? 'not-allowed' : 'pointer' }}>
                  {addingVehicle ? 'Saving...' : (editingVehicle ? 'Save Changes' : 'Add Vehicle')}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
