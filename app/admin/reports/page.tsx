'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {  
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Download, 
  Smartphone, 
  Landmark, 
  Banknote,
  Fuel,
  Wrench,
  CreditCard,
  Briefcase,
  Zap,
  HelpCircle,
} from 'lucide-react'

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
function Skeleton({ h = '16px', r = '6px', w = '100%' }: { h?: string; r?: string; w?: string }) {
  return (
    <div style={{
      width: w, 
      height: h, 
      borderRadius: r,
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

  // Clean layout design tokens
  const textDark = '#0f172a'
  const textBody = '#334155'
  const textMuted = '#64748b'
  
  const primaryGreen = '#10b981'
  const dangerRed = '#ef4444'
  const accentBlue = '#3b82f6'

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
    .filter(p => p.payment_method && p.payment_method.toLowerCase() === 'cash')
    .reduce((s, p) => s + Number(p.amount), 0)
  const ecocashRevenue = filteredPayments
    .filter(p => p.payment_method && p.payment_method.toLowerCase() === 'ecocash')
    .reduce((s, p) => s + Number(p.amount), 0)
  const bankRevenue = filteredPayments
    .filter(p => p.payment_method && p.payment_method.toLowerCase() === 'bank transfer')
    .reduce((s, p) => s + Number(p.amount), 0)

  const expensesByCategory = [
    { label: 'Fuel', icon: <Fuel size={18} />, id: 'fuel' },
    { label: 'Maintenance', icon: <Wrench size={18} />, id: 'vehicle_maintenance' },
    { label: 'ZINARA', icon: <CreditCard size={18} />, id: 'zinara' },
    { label: 'Office Supplies', icon: <Briefcase size={18} />, id: 'office_supplies' },
    { label: 'Utilities', icon: <Zap size={18} />, id: 'utilities' },
    { label: 'Other Outlays', icon: <HelpCircle size={18} />, id: 'other' },
  ].map(cat => ({
    ...cat,
    total: filteredExpenses
      .filter(e => e.category && e.category.toLowerCase() === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0),
  }))

  // ─── Export Functions ─────────────────────────────────────────────────────────

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
    combinedRows.push([])

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
    combinedRows.push([])

    // --- NET PROFIT SECTION ---
    combinedRows.push(['', '', 'NET PROFIT', netProfit.toFixed(2)])

    const csvContent = combinedRows.map(r => r.join(',')).join('\n')
    downloadCSV(`DT_Combined_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`, csvContent)
  }

  const exportCombinedPDF = async () => {
    try {
      const [{ default: jsPDF }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      // Create a simple PDF (no DOM snapshot required) to avoid CORS/layout issues.
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const marginX = 36
      let y = 54

      doc.setFontSize(16)
      doc.setTextColor(15, 23, 42)
      doc.text('DT Driving School - Combined Financial Report', marginX, y)
      y += 26

      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      doc.text(`Date range: ${startDate || 'All'} to ${endDate || 'All'}`, marginX, y)
      y += 16

      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`, marginX, y)
      y += 14
      doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, marginX, y)
      y += 14
      doc.text(`Net Profit: $${netProfit.toFixed(2)}`, marginX, y)
      y += 20

      // INCOME TABLE (top 20 rows)
      doc.setFontSize(10)
      doc.setTextColor(51, 65, 85)
      doc.text('INCOME / REVENUE', marginX, y)
      y += 14

      const incomeLines = filteredPayments.slice(0, 20).map(p => {
        const learnerObj = Array.isArray(p.learner) ? p.learner[0] : p.learner
        const name = learnerObj ? `${learnerObj.first_name} ${learnerObj.surname}` : 'Unknown'
        const date = new Date(p.payment_date).toLocaleDateString('en-GB')
        return `${date} | ${name} | ${p.payment_method} | $${Number(p.amount).toFixed(2)}`
      })

      doc.setFontSize(9)
      incomeLines.forEach(line => {
        if (y > 780) {
          doc.addPage()
          y = 54
        }
        doc.text(line, marginX, y)
        y += 12
      })

      if (filteredPayments.length > 20) {
        y += 6
        doc.text(`...and ${filteredPayments.length - 20} more payment(s)`, marginX, y)
        y += 16
      }

      // EXPENSES TABLE (top 20 rows)
      doc.setFontSize(10)
      doc.setTextColor(51, 65, 85)
      doc.text('EXPENSES', marginX, y)
      y += 14

      const expenseLines = filteredExpenses.slice(0, 20).map(e => {
        const date = new Date(e.expense_date).toLocaleDateString('en-GB')
        return `${date} | ${e.category} | $${Number(e.amount).toFixed(2)}`
      })

      doc.setFontSize(9)
      expenseLines.forEach(line => {
        if (y > 780) {
          doc.addPage()
          y = 54
        }
        doc.text(line, marginX, y)
        y += 12
      })

      if (filteredExpenses.length > 20) {
        y += 6
        doc.text(`...and ${filteredExpenses.length - 20} more expense(s)`, marginX, y)
      }

      doc.save(`DT_Combined_Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      console.error(e)
      alert('PDF export failed. Please try again.')
    }
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

      <div style={{ minHeight: '100%', padding: '0 0 32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '24px', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>Financial Reports</h1>
            <p style={{ color: textMuted, fontSize: '13.5px', margin: '4px 0 0', fontWeight: '500' }}>
              Detailed review and analysis of operational revenue, expenses, and profit margins.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={exportCombined}
                disabled={loading}
                className="hover:bg-slate-800 transition-all active:scale-[0.98]"
                style={{
                  padding: '10.5px 18px', borderRadius: '10px',
                  border: 'none', background: loading ? '#94a3b8' : '#0f172a',
                  color: 'white', fontSize: '13.5px',
                  fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.15)'
                }}
              >
                <Download size={15} />
                <span>Export Combined Statement (CSV)</span>
              </button>
              <button
                onClick={exportCombinedPDF}
                disabled={loading}
                className="hover:bg-slate-200 transition-all active:scale-[0.98]"
                style={{
                  padding: '10.5px 18px', borderRadius: '10px',
                  border: '1.5px solid #e2e8f0', background: 'white',
                  color: '#0f172a', fontSize: '13.5px',
                  fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                Export Combined Statement (PDF)
              </button>
            </div>
          </div>
        </div>

        {/* Date Filters Panel */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '28px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          border: '1px solid #edf2f7'
        }}>
          <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: '800', color: textDark, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filter Date Range
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
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
                  border: activeRange === r.id ? 'none' : '1.5px solid #cbd5e1',
                  background: activeRange === r.id ? '#0f172a' : 'white',
                  color: activeRange === r.id ? 'white' : textMuted,
                  fontSize: '12.5px', fontWeight: activeRange === r.id ? '700' : '600',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1.5px solid #edf2f7' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: textDark, marginBottom: '6px', textTransform: 'uppercase' }}>From</label>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActiveRange('custom') }}
                style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none', color: textDark, background: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: textDark, marginBottom: '6px', textTransform: 'uppercase' }}>To</label>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActiveRange('custom') }}
                style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none', color: textDark, background: 'white' }} />
            </div>
            {(startDate || endDate) && (
              <button onClick={() => applyRange('all')} className="hover:bg-slate-100 transition-colors" style={{ padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #cbd5e1', background: 'white', color: textMuted, fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', height: '40px' }}>
                Clear Choice
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Premium Lessons-style Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          
          {/* Revenue Card */}
          {loading ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', height: '110px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #f1f5f9' }}>
              <Skeleton h="54px" w="54px" r="14px" />
              <div style={{ flex: 1 }}>
                <Skeleton h="12px" w="70px" r="4px" />
                <div style={{ marginTop: '8px' }}><Skeleton h="24px" w="110px" r="6px" /></div>
                <div style={{ marginTop: '6px' }}><Skeleton h="10px" w="90px" r="4px" /></div>
              </div>
            </div>
          ) : (
            <div className="hover:scale-[1.01] hover:shadow-md transition-all duration-200"
                 style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)', border: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: '20px', minHeight: '110px' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: `${primaryGreen}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: primaryGreen, flexShrink: 0 }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue</p>
                <p style={{ margin: '0 0 2px', fontSize: '26px', fontWeight: '900', color: textDark, lineHeight: 1, letterSpacing: '-0.3px' }}>${totalRevenue.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: textMuted, fontWeight: '500' }}>{filteredPayments.length} payment(s) captured</p>
              </div>
            </div>
          )}

          {/* Expenses Card */}
          {loading ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', height: '110px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #f1f5f9' }}>
              <Skeleton h="54px" w="54px" r="14px" />
              <div style={{ flex: 1 }}>
                <Skeleton h="12px" w="70px" r="4px" />
                <div style={{ marginTop: '8px' }}><Skeleton h="24px" w="110px" r="6px" /></div>
                <div style={{ marginTop: '6px' }}><Skeleton h="10px" w="90px" r="4px" /></div>
              </div>
            </div>
          ) : (
            <div className="hover:scale-[1.01] hover:shadow-md transition-all duration-200"
                 style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)', border: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: '20px', minHeight: '110px' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: `${dangerRed}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dangerRed, flexShrink: 0 }}>
                <TrendingDown size={24} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Expenses</p>
                <p style={{ margin: '0 0 2px', fontSize: '26px', fontWeight: '900', color: textDark, lineHeight: 1, letterSpacing: '-0.3px' }}>${totalExpenses.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: textMuted, fontWeight: '500' }}>{filteredExpenses.length} record(s) logged</p>
              </div>
            </div>
          )}

          {/* Net Profit Card */}
          {loading ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', height: '110px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #f1f5f9' }}>
              <Skeleton h="54px" w="54px" r="14px" />
              <div style={{ flex: 1 }}>
                <Skeleton h="12px" w="70px" r="4px" />
                <div style={{ marginTop: '8px' }}><Skeleton h="24px" w="110px" r="6px" /></div>
                <div style={{ marginTop: '6px' }}><Skeleton h="10px" w="90px" r="4px" /></div>
              </div>
            </div>
          ) : (
            <div className="hover:scale-[1.01] hover:shadow-md transition-all duration-200"
                 style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)', border: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: '20px', minHeight: '110px' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: `${accentBlue}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentBlue, flexShrink: 0 }}>
                <Wallet size={24} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Profit</p>
                <p style={{ margin: '0 0 2px', fontSize: '26px', fontWeight: '900', color: textDark, lineHeight: 1, letterSpacing: '-0.3px' }}>${netProfit.toFixed(2)}</p>
                <span style={{ display: 'inline-block', padding: '2.5px 8px', background: '#f1f5f9', borderRadius: '8px', fontSize: '10.5px', fontWeight: '700', color: textBody }}>
                  {profitMargin}% margin
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Aggregated Breakdown Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
          
          {/* Revenue Breakdown */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #edf2f7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} style={{ color: primaryGreen }} />
                <h3 style={{ color: textDark, fontSize: '14.5px', fontWeight: '800', margin: 0 }}>Revenue Breakdown</h3>
              </div>
            </div>

            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Skeleton w="36px" h="36px" r="10px" />
                    <Skeleton w="80px" h="14px" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <Skeleton w="70px" h="14px" />
                    <Skeleton w="40px" h="10px" />
                  </div>
                </div>
              ))
            ) : (
              [
                { label: 'Cash', value: cashRevenue, icon: <Banknote size={18} />, colour: primaryGreen },
                { label: 'EcoCash', value: ecocashRevenue, icon: <Smartphone size={18} />, colour: '#7c3aed' },
                { label: 'Bank Transfer', value: bankRevenue, icon: <Landmark size={18} />, colour: '#2563eb' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                  {/* Left Block: Icon first (on left), then Name/Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', background: `${item.colour}12`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.colour }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: '13.5px', color: textDark, fontWeight: '700' }}>{item.label}</span>
                  </div>

                  {/* Right Block: Amount & % (on right) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: primaryGreen }}>+${item.value.toFixed(2)}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '600' }}>
                      {totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Expenses Breakdown */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #edf2f7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={16} style={{ color: dangerRed }} />
                <h3 style={{ color: textDark, fontSize: '14.5px', fontWeight: '800', margin: 0 }}>Expenses Breakdown</h3>
              </div>
            </div>
            
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Skeleton w="36px" h="36px" r="10px" />
                    <Skeleton w="85px" h="14px" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <Skeleton w="70px" h="14px" />
                    <Skeleton w="40px" h="10px" />
                  </div>
                </div>
              ))
            ) : expensesByCategory.filter(c => c.total > 0).length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <p style={{ color: textMuted, fontSize: '13.5px', fontWeight: '500' }}>No categorized experiences recorded.</p>
              </div>
            ) : (
              <>
                {expensesByCategory.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map((cat, i, arr) => (
                  <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    {/* Left Block: Icon first (on left), then Name/Label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
                      <div style={{ width: '36px', height: '36px', background: `${dangerRed}12`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dangerRed, border: `1.5px solid ${dangerRed}22` }}>
                        {cat.icon}
                      </div>
                      <span style={{ fontSize: '13.5px', color: textDark, fontWeight: '700' }}>{cat.label}</span>
                    </div>

                    {/* Right Block: Amount & % (on right) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: dangerRed }}>-${cat.total.toFixed(2)}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '600' }}>
                        {totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                  </div>
                ))}
                {/* Total Breakdown Summary Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: '2.5px solid #edf2f7', marginTop: '12px' }}>
                  <span style={{ fontSize: '13.5px', color: textDark, fontWeight: '800' }}>Total Breakdown</span>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: dangerRed }}>-${totalExpenses.toFixed(2)}</p>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Recent Payments Section */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #edf2f7', overflow: 'hidden', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #edf2f7' }}>
            <h3 style={{ color: textDark, fontSize: '15px', fontWeight: '800', margin: 0 }}>Recent Payments Logs</h3>
            
            <button 
              disabled={loading || filteredPayments.length === 0} 
              onClick={exportPayments} 
              className="hover:bg-slate-100 transition-colors duration-200 active:scale-[0.98]"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: (loading || filteredPayments.length === 0) ? '#f1f5f9' : '#f8fafc', 
                border: '1.5px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '8px 14px', 
                fontSize: '12.5px', 
                fontWeight: '700', 
                color: (loading || filteredPayments.length === 0) ? '#cbd5e1' : textMuted, 
                cursor: (loading || filteredPayments.length === 0) ? 'not-allowed' : 'pointer' 
              }}
            >
              <Download size={14} />
              <span>Download CSV Sheet</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2fr 1.2fr', padding: '14px 24px', borderBottom: '1px solid #edf2f7', background: '#f8fafc' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'left', paddingLeft: '12px' }}>Payment Method</p>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'center' }}>Amount (USD)</p>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'center' }}>Learner Name</p>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'center' }}>Recorded Date</p>
          </div>

          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2fr 1.2fr', padding: '18px 24px', borderBottom: '1px solid #edf2f7', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start', paddingLeft: '12px' }}><Skeleton w="32px" h="32px" r="8px" /><Skeleton w="90px" h="14px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="70px" h="14px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="140px" h="14px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="80px" h="14px" /></div>
              </div>
            ))
          ) : filteredPayments.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ color: textMuted, fontSize: '13.5px', fontWeight: '600', margin: 0 }}>No payments registered in this selection.</p>
            </div>
          ) : (
            <>
              {filteredPayments.map(p => {
                const learnerObj = Array.isArray(p.learner) ? p.learner[0] : p.learner
                const fName = learnerObj?.first_name || '—'
                const sName = learnerObj?.surname || ''
                const method = p.payment_method?.toLowerCase() || ''
                
                let mIcon = <Banknote size={16} />
                let mColor = primaryGreen
                if (method === 'ecocash') {
                  mIcon = <Smartphone size={16} />
                  mColor = '#7c3aed'
                } else if (method === 'bank transfer') {
                  mIcon = <Landmark size={16} />
                  mColor = '#2563eb'
                }

                return (
                  <div key={p.payment_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2fr 1.2fr', padding: '18px 24px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                    {/* Method details - left-aligned - LUCID ICON RENDERS FIRST */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start', paddingLeft: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${mColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mColor, border: `1px solid ${mColor}22` }}>
                        {mIcon}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: textDark }}>{p.payment_method}</span>
                    </div>

                    {/* Centered Amount */}
                    <p style={{ margin: 0, fontSize: '15.5px', fontWeight: '900', color: textDark, textAlign: 'center' }}>${Number(p.amount).toFixed(2)}</p>

                    {/* Centered Learner Name */}
                    <p style={{ margin: 0, fontSize: '14px', color: textDark, fontWeight: '600', textAlign: 'center' }}>{fName} {sName}</p>

                    {/* Centered Date Badge */}
                    <p style={{ margin: 0, fontSize: '13px', color: mColor, fontWeight: '700', textAlign: 'center' }}>
                      {new Date(p.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )
              })}
              {/* Dynamic Footer Total Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2fr 1.2fr', padding: '16px 24px', borderTop: '2.5px solid #cbd5e1', background: '#f8fafc', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: textDark, paddingLeft: '12px' }}>Total Payments</p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: primaryGreen, textAlign: 'center' }}>${totalRevenue.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '13px', color: textMuted, fontWeight: '700', textAlign: 'center' }}>{filteredPayments.length} payment(s)</p>
                <p style={{ margin: 0 }}></p>
              </div>
            </>
          )}
        </div>

        {/* Recent Expenses Section */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #edf2f7', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #edf2f7' }}>
            <h3 style={{ color: textDark, fontSize: '15px', fontWeight: '800', margin: 0 }}>Recent Expenses Logs</h3>

            <button 
              disabled={loading || filteredExpenses.length === 0} 
              onClick={exportExpenses} 
              className="hover:bg-slate-100 transition-colors duration-200 active:scale-[0.98]"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: (loading || filteredExpenses.length === 0) ? '#f1f5f9' : '#f8fafc', 
                border: '1.5px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '8px 14px', 
                fontSize: '12.5px', 
                fontWeight: '700', 
                color: (loading || filteredExpenses.length === 0) ? '#cbd5e1' : textMuted, 
                cursor: (loading || filteredExpenses.length === 0) ? 'not-allowed' : 'pointer' 
              }}
            >
              <Download size={14} />
              <span>Download CSV Sheet</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2.2fr 1.2fr', padding: '14px 24px', borderBottom: '1px solid #edf2f7', background: '#f8fafc' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'left', paddingLeft: '12px' }}>Category</p>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'center' }}>Amount (USD)</p>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'center' }}>Description</p>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'center' }}>Expense Date</p>
          </div>

          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2.2fr 1.2fr', padding: '18px 24px', borderBottom: '1px solid #edf2f7', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start', paddingLeft: '12px' }}><Skeleton w="32px" h="32px" r="8px" /><Skeleton w="90px" h="14px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="70px" h="14px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="160px" h="14px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="80px" h="14px" /></div>
              </div>
            ))
          ) : filteredExpenses.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ color: textMuted, fontSize: '13.5px', fontWeight: '600', margin: 0 }}>No expenses logged in this selection.</p>
            </div>
          ) : (
            <>
              {filteredExpenses.map(e => {
                const catId = e.category?.toLowerCase() || ''
                let cIcon = <HelpCircle size={16} />
                let cLabel = 'Other Outlays'
                let cColor = '#64748b'

                if (catId === 'fuel') {
                  cIcon = <Fuel size={16} />
                  cLabel = 'Fuel'
                  cColor = primaryGreen
                } else if (catId === 'vehicle_maintenance' || catId === 'maintenance') {
                  cIcon = <Wrench size={16} />
                  cLabel = 'Maintenance'
                  cColor = '#f97316'
                } else if (catId === 'zinara') {
                  cIcon = <CreditCard size={16} />
                  cLabel = 'ZINARA'
                  cColor = '#ef4444'
                } else if (catId === 'office_supplies') {
                  cIcon = <Briefcase size={16} />
                  cLabel = 'Office Supplies'
                  cColor = '#3b82f6'
                } else if (catId === 'utilities') {
                  cIcon = <Zap size={16} />
                  cLabel = 'Utilities'
                  cColor = '#eab308'
                }

                return (
                  <div key={e.expense_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2.2fr 1.2fr', padding: '18px 24px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                    {/* Category details - aligned starting from the left - LUCID ICON RENDERS FIRST */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start', paddingLeft: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${cColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cColor, border: `1.5px solid ${cColor}22` }}>
                        {cIcon}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: textDark }}>{cLabel}</span>
                    </div>

                    {/* Centered Amount */}
                    <p style={{ margin: 0, fontSize: '15.5px', fontWeight: '900', color: textDark, textAlign: 'center' }}>${Number(e.amount).toFixed(2)}</p>

                    {/* Centered Description */}
                    <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500', textAlign: 'center' }}>{e.description || '—'}</p>

                    {/* Centered Date Badge */}
                    <p style={{ margin: 0, fontSize: '13px', color: textBody, fontWeight: '600', textAlign: 'center' }}>
                      {new Date(e.expense_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )
              })}
              {/* Dynamic Footer Total Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 1fr 2.2fr 1.2fr', padding: '16px 24px', borderTop: '2.5px solid #cbd5e1', background: '#f8fafc', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: textDark, paddingLeft: '12px' }}>Total Expenses</p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: dangerRed, textAlign: 'center' }}>-${totalExpenses.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '13px', color: textMuted, fontWeight: '700', textAlign: 'center' }}>{filteredExpenses.length} expense(s)</p>
                <p style={{ margin: 0 }}></p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}