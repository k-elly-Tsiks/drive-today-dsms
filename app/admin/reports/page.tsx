'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Payment {
  payment_id: string
  amount: number
  payment_date: string
  payment_method: string
  transaction_ref?: string
  learner?: {
    first_name: string
    surname: string
  } | unknown
}

interface Expense {
  expense_id: string
  amount: number
  expense_date: string
  category: string
  description?: string
  vehicle_id?: string
}

const supabase = createClient()

// ── Skeleton Loader (Matching AdminDashboard) ────────────
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

export default function ReportsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeRange, setActiveRange] = useState('all')

  const router = useRouter()
  const routerRef = useRef(router)

  // Design tokens to match Payments and Expenses modules
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const primaryGreen = '#10b981'

  // ─── Auth + Data Loading ─────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        payment_id, amount, payment_date, payment_method, transaction_ref,
        learner:users!payments_learner_id_fkey (first_name, surname)
      `)
      .order('payment_date', { ascending: false })

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })

    // Use 'as unknown as Payment[]' to bypass strict TS checking on the joined 'learner' array
    setPayments((paymentsData as unknown as Payment[]) || [])
    setExpenses(expensesData || [])
    setLoading(false)
  }, [])

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (data?.role !== 'admin') { routerRef.current.push('/login'); return }
    await loadData()
  }, [loadData])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await checkAdmin()
    }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  // ─── Date Range Helpers ───────────────────────────────────────────────────────

  function applyRange(range: string) {
    setActiveRange(range)
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    if (range === 'all') {
      setStartDate('')
      setEndDate('')
    } else if (range === 'today') {
      setStartDate(today)
      setEndDate(today)
    } else if (range === 'week') {
      const weekAgo = new Date(now)
      weekAgo.setDate(now.getDate() - 7)
      setStartDate(weekAgo.toISOString().split('T')[0])
      setEndDate(today)
    } else if (range === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      setStartDate(monthStart.toISOString().split('T')[0])
      setEndDate(today)
    } else if (range === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      setStartDate(yearStart.toISOString().split('T')[0])
      setEndDate(today)
    }
  }

  // ─── Derived State ────────────────────────────────────────────────────────────

  const filteredPayments = payments.filter(p => {
    if (!startDate && !endDate) return true
    const date = new Date(p.payment_date).toISOString().split('T')[0]
    if (startDate && date < startDate) return false
    if (endDate && date > endDate) return false
    return true
  })

  const filteredExpenses = expenses.filter(e => {
    if (!startDate && !endDate) return true
    const date = new Date(e.expense_date).toISOString().split('T')[0]
    if (startDate && date < startDate) return false
    if (endDate && date > endDate) return false
    return true
  })

  const totalRevenue = filteredPayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0
    ? ((netProfit / totalRevenue) * 100).toFixed(1)
    : '0.0'

  const cashRevenue = filteredPayments
    .filter(p => p.payment_method.toLowerCase() === 'cash')
    .reduce((s, p) => s + Number(p.amount), 0)
  const ecocashRevenue = filteredPayments
    .filter(p => p.payment_method.toLowerCase() === 'ecocash')
    .reduce((s, p) => s + Number(p.amount), 0)
  const bankRevenue = filteredPayments
    .filter(p => p.payment_method.toLowerCase() === 'bank transfer')
    .reduce((s, p) => s + Number(p.amount), 0)

  const expensesByCategory = [
    { label: 'Fuel', icon: '⛽', id: 'fuel' },
    { label: 'Maintenance', icon: '🔧', id: 'maintenance' },
    { label: 'ZINARA/Tolls', icon: '🎫', id: 'zinara' },
    { label: 'Office Supplies', icon: '📎', id: 'office_supplies' },
    { label: 'Utilities', icon: '💡', id: 'utilities' },
    { label: 'Other', icon: '📦', id: 'other' },
  ].map(cat => ({
    ...cat,
    total: filteredExpenses
      .filter(e => e.category.toLowerCase() === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0),
  }))

  // ─── Export to Excel (CSV) ─────────────────────────────────────────────────────

  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportPayments = () => {
    const headers = ['Date', 'Learner Name', 'Amount', 'Method', 'Reference']
    const rows = filteredPayments.map(p => {
      const learnerObj = Array.isArray(p.learner) ? p.learner[0] : p.learner
      const fName = learnerObj?.first_name || ''
      const sName = learnerObj?.surname || ''
      return [
        new Date(p.payment_date).toLocaleDateString(),
        `"${fName} ${sName}"`,
        p.amount.toFixed(2),
        p.payment_method,
        `"${p.transaction_ref || ''}"`
      ]
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    downloadCSV(`DT_Payments_Report_${new Date().toISOString().split('T')[0]}.csv`, csvContent)
  }

  const exportExpenses = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount']
    const rows = filteredExpenses.map(e => [
      new Date(e.expense_date).toLocaleDateString(),
      e.category,
      `"${e.description || ''}"`,
      e.amount.toFixed(2)
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    downloadCSV(`DT_Expenses_Report_${new Date().toISOString().split('T')[0]}.csv`, csvContent)
  }

  const exportCombined = () => {
    const combinedRows: string[][] = []

    // --- INCOME SECTION ---
    combinedRows.push(['INCOME / REVENUE'])
    combinedRows.push(['Date', 'Payment Method', 'Learner Name', 'Amount'])
    
    filteredPayments.forEach(p => {
      const learnerObj = Array.isArray(p.learner) ? p.learner[0] : p.learner
      const fName = learnerObj?.first_name || ''
      const sName = learnerObj?.surname || ''
      combinedRows.push([
        new Date(p.payment_date).toLocaleDateString(),
        p.payment_method,
        `"${fName} ${sName}"`,
        p.amount.toFixed(2)
      ])
    })
    
    combinedRows.push(['', '', 'TOTAL REVENUE', totalRevenue.toFixed(2)])
    combinedRows.push([]) // empty row

    // --- EXPENSES SECTION ---
    combinedRows.push(['EXPENSES'])
    combinedRows.push(['Date', 'Category', 'Description', 'Amount'])
    
    filteredExpenses.forEach(e => {
      combinedRows.push([
        new Date(e.expense_date).toLocaleDateString(),
        e.category,
        `"${e.description || ''}"`,
        e.amount.toFixed(2)
      ])
    })
    
    combinedRows.push(['', '', 'TOTAL EXPENSES', totalExpenses.toFixed(2)])
    combinedRows.push([]) // empty row

    // --- NET PROFIT SECTION ---
    combinedRows.push(['', '', 'NET PROFIT', netProfit.toFixed(2)])

    const csvContent = combinedRows.map(r => r.join(',')).join('\n')
    downloadCSV(`DT_Combined_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`, csvContent)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

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
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>📊 Financial Reports</h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>
              View and download revenue, expenses and profit analysis
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={exportCombined}
              disabled={loading}
              style={{
                padding: '10px 18px', borderRadius: '8px',
                border: 'none', background: loading ? '#94a3b8' : textDark,
                color: 'white', fontSize: '13px',
                fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span>📥</span> Export Combined Report
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px', marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: textDark }}>
            Filter Date Range
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => applyRange(r.id)}
                style={{
                  padding: '8px 16px', borderRadius: '20px',
                  border: activeRange === r.id ? 'none' : '1px solid #e2e8f0',
                  background: activeRange === r.id ? textDark : 'white',
                  color: activeRange === r.id ? 'white' : textMuted,
                  fontSize: '12px', fontWeight: activeRange === r.id ? '700' : '600',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: textDark, marginBottom: '6px' }}>From</label>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActiveRange('custom') }}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: textDark }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: textDark, marginBottom: '6px' }}>To</label>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActiveRange('custom') }}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: textDark }} />
            </div>
            {(startDate || endDate) && (
              <button onClick={() => applyRange('all')} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textMuted, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Clear Custom Range
              </button>
            )}
          </div>
        </div>

        {/* Main Financial Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderTop: `4px solid ${primaryGreen}` }}>
            {loading ? (
               <>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Skeleton w="32px" h="32px" r="50%" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="80px" h="13px" r="4px" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="100px" h="28px" r="6px" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}><Skeleton w="60px" h="11px" r="4px" /></div>
               </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '32px' }}>💰</p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Total Revenue</p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: primaryGreen }}>${totalRevenue.toFixed(2)}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: textMuted }}>{filteredPayments.length} payment(s)</p>
              </>
            )}
          </div>

          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderTop: '4px solid #dc2626' }}>
            {loading ? (
               <>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Skeleton w="32px" h="32px" r="50%" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="80px" h="13px" r="4px" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="100px" h="28px" r="6px" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}><Skeleton w="60px" h="11px" r="4px" /></div>
               </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '32px' }}>🧾</p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Total Expenses</p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#dc2626' }}>${totalExpenses.toFixed(2)}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: textMuted }}>{filteredExpenses.length} record(s)</p>
              </>
            )}
          </div>

          <div style={{ background: textDark, borderRadius: '14px', padding: '24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {loading ? (
               <>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Skeleton w="32px" h="32px" r="50%" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="80px" h="13px" r="4px" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="100px" h="28px" r="6px" /></div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}><Skeleton w="100px" h="18px" r="12px" /></div>
               </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '32px' }}>{netProfit >= 0 ? '📈' : '📉'}</p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#cbd5e1', fontWeight: '600', textTransform: 'uppercase' }}>Net Profit</p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'white' }}>${netProfit.toFixed(2)}</p>
                <div style={{ display: 'inline-block', margin: '8px 0 0', padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', fontWeight: '600', color: '#f8fafc' }}>
                  {profitMargin}% Profit Margin
                </div>
              </>
            )}
          </div>

        </div>

        {/* Two column breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: textDark, fontSize: '15px', fontWeight: '800', margin: 0 }}>💰 Revenue Breakdown</h3>
              <button disabled={loading} onClick={exportPayments} style={{ background: loading ? '#f1f5f9' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: loading ? '#cbd5e1' : textMuted, cursor: loading ? 'not-allowed' : 'pointer' }}>
                Download CSV
              </button>
            </div>

            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton w="36px" h="36px" r="10px" />
                    <Skeleton w="80px" h="13px" r="4px" />
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <Skeleton w="60px" h="15px" r="4px" />
                    <Skeleton w="30px" h="11px" r="4px" />
                  </div>
                </div>
              ))
            ) : (
              [
                { label: 'Cash', value: cashRevenue, icon: '💵', colour: primaryGreen },
                { label: 'EcoCash', value: ecocashRevenue, icon: '📱', colour: '#7c3aed' },
                { label: 'Bank Transfer', value: bankRevenue, icon: '🏦', colour: '#2563eb' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{item.icon}</div>
                    <span style={{ fontSize: '13px', color: textDark, fontWeight: '700' }}>{item.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: item.colour }}>${item.value.toFixed(2)}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '600' }}>
                      {totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: textDark, fontSize: '15px', fontWeight: '800', margin: 0 }}>🧾 Expenses Breakdown</h3>
              <button disabled={loading} onClick={exportExpenses} style={{ background: loading ? '#f1f5f9' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: loading ? '#cbd5e1' : textMuted, cursor: loading ? 'not-allowed' : 'pointer' }}>
                Download CSV
              </button>
            </div>
            
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton w="36px" h="36px" r="10px" />
                    <Skeleton w="90px" h="13px" r="4px" />
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <Skeleton w="60px" h="15px" r="4px" />
                    <Skeleton w="30px" h="11px" r="4px" />
                  </div>
                </div>
              ))
            ) : expensesByCategory.filter(c => c.total > 0).length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <p style={{ color: textMuted, fontSize: '13px', fontWeight: '500' }}>No expenses recorded in this period.</p>
              </div>
            ) : (
              expensesByCategory.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map((cat, i, arr) => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{cat.icon}</div>
                    <span style={{ fontSize: '13px', color: textDark, fontWeight: '700' }}>{cat.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#dc2626' }}>${cat.total.toFixed(2)}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '600' }}>
                      {totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </>
  )
}
