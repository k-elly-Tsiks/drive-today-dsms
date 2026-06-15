'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Search, 
  MoreVertical,
  Calendar,
  Layers,
  Fuel,
  Wrench,
  Printer,
  Megaphone,
  Shield,
  FileText,
  XCircle,
  CheckCircle,
  TrendingDown
} from 'lucide-react'

interface Expense {
  expense_id: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  recorded_by: string
  vehicle_id?: string | null
}

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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [recording, setRecording] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Date Range Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Expense Form fields
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])

  const router = useRouter()
  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement | null>(null)


  // Configuration mapping for categories
  const categoriesConfig = [
    { id: 'fuel', label: 'Fuel Allowance', icon: <Fuel size={14} />, color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
    { id: 'vehicle_maintenance', label: 'Repair & Maintenance', icon: <Wrench size={14} />, color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
    { id: 'zinara', label: 'ZINARA Licensing', icon: <Shield size={14} />, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    { id: 'office_supplies', label: 'Office Supplies', icon: <Printer size={14} />, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { id: 'utilities', label: 'Utilities & Power', icon: <Megaphone size={14} />, color: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' },
    { id: 'other', label: 'Other Operational', icon: <FileText size={14} />, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  ]

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
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

    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [router, supabase, loadData])

  // ── Expenses Logic
  async function recordExpense() {
    if (!category || !amount || !expenseDate || !description) { 
      showToast('Please fill in all required operational metrics.', 'error')
      return 
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) { 
      showToast('Amount must be a positive number.', 'error')
      return 
    }
    setRecording(true)

    const payload = {
      category,
      amount: parsedAmount,
      description: description,
      expense_date: expenseDate,
    }

    let errorOccurred = false

    if (editingExpense) {
      const { error: updateError } = await supabase
        .from('expenses')
        .update(payload)
        .eq('expense_id', editingExpense.expense_id)
      if (updateError) errorOccurred = true
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('expenses').insert({
        ...payload,
        recorded_by: user?.id,
      })
      if (insertError) errorOccurred = true
    }

    if (errorOccurred) { 
      showToast('Failed to write expense to database.', 'error')
      setRecording(false)
      return 
    }

    showToast(`Expense ${editingExpense ? 'updated' : 'recorded'} successfully.`)
    closeModal()
    loadData()
  }

  function openEditModal(expense: Expense) {
    setEditingExpense(expense)
    setCategory(expense.category)
    setAmount(expense.amount.toString())
    setDescription(expense.description || '')
    setExpenseDate(expense.expense_date)
    setShowModal(true)
    setActiveMenuId(null)
  }

  function closeModal() {
    setShowModal(false)
    setEditingExpense(null)
    setCategory('')
    setAmount('')
    setDescription('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setRecording(false)
  }

  async function deleteExpense(expenseId: string) {
    if (!confirm('Are you sure you want to delete this expense record?')) return
    const { error } = await supabase.from('expenses').delete().eq('expense_id', expenseId)
    if (error) { 
      showToast('Failed to delete transaction logging.', 'error')
      return 
    }
    showToast('Transaction was permanently purged from ledger.', 'error')
    setActiveMenuId(null)
    loadData()
  }

  function getCategoryInfo(cat: string) { 
    return categoriesConfig.find(c => c.id === cat) || { label: cat, icon: <FileText size={14} />, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' } 
  }

  // Filters logic
  const filteredExpenses = expenses.filter(e => {
    const q = search.toLowerCase()
    const matchesSearch = !q || e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)
    const matchesFilter = filterCategory === 'all' || e.category === filterCategory
    
    const expDate = e.expense_date
    const matchesFrom = !fromDate || expDate >= fromDate
    const matchesTo = !toDate || expDate <= toDate

    return matchesSearch && matchesFilter && matchesFrom && matchesTo
  })

  // Calculations
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const thisMonthExpenses = expenses.filter(e => {
    const expDate = new Date(e.expense_date)
    const now = new Date()
    return (expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear())
  }).reduce((sum, e) => sum + Number(e.amount), 0)

  const monthName = new Date().toLocaleString('en-GB', { month: 'short' })

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .row-hover { transition: background 0.15s ease; }
        .row-hover:hover { background: #f8fafc; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(4px); padding: 20px; }
        .modal-card { background: white; border-radius: 20px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); padding: 30px; }
        .kpi-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease; cursor: default; }
        .kpi-card:hover { border-color: #ff5a00; transform: translateY(-2px); }
        .info-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; display: block; }
        .dashboard-control { height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; font-size: 13px; color: #1e293b; font-weight: 505; outline: none; transition: all 0.2s ease; }
        .dashboard-control:focus { border-color: #ff5a00; box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.1); }
        
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
        
        .menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 14px; border: none; background: none; font-size: 13px; font-weight: 600; cursor: pointer; color: #475569; transition: all 0.15s ease; text-align: left; }
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
            <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.5px' }}>Operational Expenses</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Record operational cash burn, purchase logs, and school assets overhead</p>
          </div>
          <button onClick={() => { setCategory('fuel'); setShowModal(true); }} className="custom-btn-primary">
            <PlusCircle size={18} /> Record New Expense
          </button>
        </div>

        {/* STATS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
          {loading ? (
             Array(3).fill(0).map((_, i) => (
                <div key={i} className="kpi-card">
                  <div><Skeleton w="80px" h="12px" /><div style={{ marginTop: '8px' }}><Skeleton w="50px" h="28px" /></div></div>
                  <Skeleton w="42px" h="42px" r="12px" />
                </div>
             ))
          ) : (
            [
              { label: 'Cumulative Expenditure', val: `$${totalExpenses.toFixed(2)}`, sub: 'All items tracked', icon: <TrendingDown size={18} color="#dc2626" />, bg: '#fef2f2' },
              { label: `Current Month Expenses (${monthName})`, val: `$${thisMonthExpenses.toFixed(2)}`, sub: 'Active period burn', icon: <Calendar size={18} color="#ff5a00" />, bg: '#fff1eb' },
              { label: 'Total Logs Counter', val: `${expenses.length} records`, sub: 'Operational logs filed', icon: <Layers size={18} color="#2563eb" />, bg: '#eff6ff' }
            ].map((s, i) => (
              <div key={i} className="kpi-card">
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>{s.val}</p>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.icon}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Filter Toolbar Section */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', alignItems: 'flex-end' }}>
          
          {/* Dropdown Categories Filter (Redesigned matching learner/class filtering code) */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</span>
            <select 
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="dashboard-control"
              style={{ paddingRight: '28px', cursor: 'pointer', fontWeight: '700', color: '#1e293b' }}
            >
              <option value="all">All Categories</option>
              {categoriesConfig.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              placeholder="Search descriptions, vouchers, receipt codes..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="dashboard-control" 
              style={{ width: '100%', paddingLeft: '40px' }} 
            />
          </div>

          {/* Date from Limit */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>From Date</span>
            <input 
              type="date" 
              value={fromDate} 
              onChange={e => setFromDate(e.target.value)} 
              className="dashboard-control" 
            />
          </div>

          {/* Date to Limit */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>To Date</span>
            <input 
              type="date" 
              value={toDate} 
              onChange={e => setToDate(e.target.value)} 
              className="dashboard-control" 
            />
          </div>

          {/* Reset Filters Option */}
          {(fromDate || toDate || filterCategory !== 'all') && (
            <button 
              onClick={() => { setFromDate(''); setToDate(''); setFilterCategory('all'); }}
              className="custom-btn-secondary"
              style={{ height: '42.5px', fontSize: '11.5px', fontWeight: '700' }}
            >
              Reset Filters
            </button>
          )}

        </div>

        {/* LEDGER DATA TABLE */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ minWidth: '950px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 2.5fr 1.2fr 100px', padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
              <span style={{ textAlign: 'left' }}>CATEGORY</span>
              <span style={{ textAlign: 'left' }}>LEDGER COST</span>
              <span style={{ textAlign: 'left' }}>DESCRIPTION / MOTIVE</span>
              <span style={{ textAlign: 'center' }}>VOUCHER DATE</span>
              <span style={{ textAlign: 'center' }}>ADMIN ACTIONS</span>
            </div>

            {loading ? (
              <div style={{ padding: '40px' }}><Skeleton h="120px" /></div>
            ) : filteredExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '56px', color: '#64748b', fontSize: '13.5px', fontWeight: '500' }}>No overhead entries identified matching filters.</div>
            ) : filteredExpenses.map(expense => {
              const catInfo = getCategoryInfo(expense.category)
              return (
                <div key={expense.expense_id} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 2.5fr 1.2fr 100px', padding: '16px 24px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
                  
                  {/* Category Pill Badge representation */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: `${catInfo.color}15`, border: `1px solid ${catInfo.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: catInfo.color, flexShrink: 0 }}>
                      {catInfo.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: '750', fontSize: '13.5px', color: '#1e293b' }}>{catInfo.label}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Category Tag</div>
                    </div>
                  </div>

                  {/* Financial Amount Value */}
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#e11d48', fontFamily: 'monospace', textAlign: 'left' }}>
                    -${Number(expense.amount).toFixed(2)}
                  </span>

                  {/* Operational Details notes */}
                  <span style={{ fontWeight: '500', color: '#475569', fontSize: '13px', textAlign: 'left' }} className="truncate">
                    {expense.description || '—'}
                  </span>

                  {/* Transaction filing date */}
                  <span style={{ fontWeight: '600', color: '#64748b', fontSize: '12.5px', textAlign: 'center' }}>
                    {new Date(expense.expense_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>

                  {/* Interactive Three-Dots Dropdown context menu trigger */}
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === expense.expense_id ? null : expense.expense_id)} 
                      style={{ 
                        border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: activeMenuId === expense.expense_id ? '#ff5a00' : '#94a3b8',
                        background: activeMenuId === expense.expense_id ? '#fff1eb' : 'transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {activeMenuId === expense.expense_id && (
                      <div 
                        ref={menuRef} 
                        style={{ 
                          position: 'absolute', right: '100%', top: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', 
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03)', zIndex: 100, width: '150px', overflow: 'hidden', marginRight: '8px' 
                        }}
                      >
                        <button className="menu-item" onClick={() => openEditModal(expense)}>
                          <Edit3 size={13.5} color="#2563eb" /> Edit Record
                        </button>
                        <button className="menu-item" style={{ color: '#dc2626' }} onClick={() => deleteExpense(expense.expense_id)}>
                          <Trash2 size={13.5} color="#dc2626" /> Delete Record
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )
            })}
          </div>

          {/* Table Footer total summing visibility matching */}
          {!loading && filteredExpenses.length > 0 && (
            <div style={{ padding: '20px 24px', background: '#fcfcfd', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active filtered expenditures sum</span>
              <span style={{ fontSize: '14.5px', fontWeight: '850', color: '#1e293b', fontFamily: 'monospace' }}>
                -${filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* EXPENSE RECORDING & EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 style={{ margin: '0 0 4px', fontSize: '19px', fontWeight: '800', color: '#1e293b' }}>
              {editingExpense ? 'Edit Operational Record' : 'Record School Expense'}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
              File actual academy overhead and generate ledger transaction vouchers.
            </p>

            <label className="info-label">Category Group Selection</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {categoriesConfig.map(cat => {
                const isSelected = category === cat.id
                return (
                  <button 
                    key={cat.id} 
                    type="button" 
                    onClick={() => setCategory(cat.id)} 
                    style={{ 
                      padding: '10px 12px', borderRadius: '10px', border: isSelected ? '1.5px solid #1e293b' : '1px solid #e2e8f0', 
                      background: isSelected ? '#f8fafc' : 'white', color: '#1e293b', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.1s' 
                    }}
                  >
                    <span style={{ color: isSelected ? 'inherit' : cat.color }}>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Price cost and date columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label className="info-label">Expense Cost ($)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="dashboard-control" 
                  style={{ width: '100%', fontWeight: '700' }} 
                />
              </div>
              <div>
                <label className="info-label">Acquisition Date</label>
                <input 
                  type="date" 
                  value={expenseDate} 
                  onChange={e => setExpenseDate(e.target.value)} 
                  className="dashboard-control" 
                  style={{ width: '100%' }} 
                />
              </div>
            </div>

            {/* Detailed Notes */}
            <div style={{ marginBottom: '25px' }}>
              <label className="info-label">Precise Notes & Voucher Details</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Describe specific items purchased, fuel litres or registration codes e.g., Oil adjustment for Nissan March Class 4" 
                rows={3} 
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: '500' }} 
              />
            </div>

            {/* Modal Controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={closeModal} className="custom-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={recordExpense} disabled={recording} className="custom-btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {recording ? 'Filing entry...' : (editingExpense ? 'Update Record' : 'Record Transaction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}