'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Payment {
  payment_id: string
  amount: number
  payment_date: string
  payment_method: string
  learner?: {
    first_name: string
    surname: string
  }
}

interface Expense {
  expense_id: string
  amount: number
  expense_date: string
  category: string
  description?: string
}

const supabase = createClient()

export default function ReportsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeRange, setActiveRange] = useState('all')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        *,
        learner:users!payments_learner_id_fkey (first_name, surname)
      `)
      .order('payment_date', { ascending: false })

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })

    setPayments(paymentsData || [])
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

  // ─── Date range helpers ───────────────────────────────────────────────────────

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

  // ─── Derived state ────────────────────────────────────────────────────────────

  const filteredPayments = payments.filter(p => {
    if (!startDate && !endDate) return true
    const date = new Date(p.payment_date).toISOString().split('T')[0]
    if (startDate && date < startDate) return false
    if (endDate && date > endDate) return false
    return true
  })

  const filteredExpenses = expenses.filter(e => {
    if (!startDate && !endDate) return true
    const date = e.expense_date
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
    .filter(p => p.payment_method === 'cash')
    .reduce((s, p) => s + Number(p.amount), 0)
  const ecocashRevenue = filteredPayments
    .filter(p => p.payment_method === 'EcoCash')
    .reduce((s, p) => s + Number(p.amount), 0)
  const bankRevenue = filteredPayments
    .filter(p => p.payment_method === 'bank transfer')
    .reduce((s, p) => s + Number(p.amount), 0)

  const expensesByCategory = [
    { label: 'Fuel', icon: '⛽', id: 'fuel' },
    { label: 'Maintenance', icon: '🔧', id: 'vehicle_maintenance' },
    { label: 'Office Supplies', icon: '📎', id: 'office_supplies' },
    { label: 'Insurance', icon: '🛡', id: 'insurance' },
    { label: 'Utilities', icon: '💡', id: 'utilities' },
    { label: 'Other', icon: '📦', id: 'other' },
  ].map(cat => ({
    ...cat,
    total: filteredExpenses
      .filter(e => e.category === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0),
  }))

  // ─── Loading state ────────────────────────────────────────────────────────────

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
        <p style={{ color: blue, fontWeight: '600' }}>Loading Reports...</p>
      </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            📊 Financial Reports
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            View revenue, expenses and profit with date range filtering
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
          ← Dashboard
        </button>
      </div>

      {/* Date Range Filter */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '20px', marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: blue }}>
          Filter by Date Range
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
                border: activeRange === r.id ? 'none' : '1px solid #e5e7eb',
                background: activeRange === r.id
                  ? `linear-gradient(135deg, ${blue}, ${orange})`
                  : 'white',
                color: activeRange === r.id ? 'white' : '#6b7280',
                fontSize: '12px', fontWeight: activeRange === r.id ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{
              display: 'block', fontSize: '12px',
              fontWeight: '600', color: '#374151', marginBottom: '4px',
            }}>
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActiveRange('custom') }}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '13px', outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block', fontSize: '12px',
              fontWeight: '600', color: '#374151', marginBottom: '4px',
            }}>
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActiveRange('custom') }}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '13px', outline: 'none',
              }}
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => applyRange('all')}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid #e5e7eb', background: 'white',
                color: '#6b7280', fontSize: '12px',
                cursor: 'pointer', marginTop: '18px',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Financial Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px', marginBottom: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '24px', textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          borderTop: '4px solid #059669',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '32px' }}>💰</p>
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
            Total Revenue
          </p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#059669' }}>
            ${totalRevenue.toFixed(2)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>
            {filteredPayments.length} payment(s)
          </p>
        </div>

        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '24px', textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          borderTop: '4px solid #dc2626',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '32px' }}>🧾</p>
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
            Total Expenses
          </p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#dc2626' }}>
            ${totalExpenses.toFixed(2)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>
            {filteredExpenses.length} record(s)
          </p>
        </div>

        <div style={{
          background: netProfit >= 0
            ? 'linear-gradient(135deg, #1e3a8a, #2d4fa3)'
            : 'linear-gradient(135deg, #dc2626, #ef4444)',
          borderRadius: '14px',
          padding: '24px', textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '32px' }}>
            {netProfit >= 0 ? '📈' : '📉'}
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
            Net Profit
          </p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'white' }}>
            ${netProfit.toFixed(2)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
            {profitMargin}% profit margin
          </p>
        </div>
      </div>

      {/* Two column breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px', marginBottom: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: '0 0 16px' }}>
            💰 Revenue by Payment Method
          </h3>
          {[
            { label: 'Cash', value: cashRevenue, icon: '💵', colour: '#059669' },
            { label: 'EcoCash', value: ecocashRevenue, icon: '📱', colour: '#7c3aed' },
            { label: 'Bank Transfer', value: bankRevenue, icon: '🏦', colour: blue },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 0',
              borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                  {item.label}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: item.colour }}>
                  ${item.value.toFixed(2)}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                  {totalRevenue > 0
                    ? ((item.value / totalRevenue) * 100).toFixed(1)
                    : '0.0'}%
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: '0 0 16px' }}>
            🧾 Expenses by Category
          </h3>
          {expensesByCategory
            .filter(c => c.total > 0)
            .sort((a, b) => b.total - a.total)
            .map((cat, i, arr) => (
              <div key={cat.id} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                    {cat.label}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#dc2626' }}>
                    ${cat.total.toFixed(2)}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                    {totalExpenses > 0
                      ? ((cat.total / totalExpenses) * 100).toFixed(1)
                      : '0.0'}%
                  </p>
                </div>
              </div>
            ))}
          {expensesByCategory.every(c => c.total === 0) && (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              No expenses in this period
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
      }}>
        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: 0 }}>
              Recent Payments
            </h3>
            <button
              onClick={() => router.push('/admin/payments')}
              style={{
                background: 'none', border: 'none',
                color: orange, fontSize: '12px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              View all →
            </button>
          </div>
          {filteredPayments.slice(0, 5).length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              No payments in this period
            </p>
          ) : (
            filteredPayments.slice(0, 5).map((payment, i) => (
              <div key={payment.payment_id} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {payment.learner?.first_name} {payment.learner?.surname}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {payment.payment_method} • {new Date(payment.payment_date).toLocaleDateString()}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#059669' }}>
                  ${Number(payment.amount).toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>

        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: 0 }}>
              Recent Expenses
            </h3>
            <button
              onClick={() => router.push('/admin/expenses')}
              style={{
                background: 'none', border: 'none',
                color: orange, fontSize: '12px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              View all →
            </button>
          </div>
          {filteredExpenses.slice(0, 5).length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              No expenses in this period
            </p>
          ) : (
            filteredExpenses.slice(0, 5).map((expense, i) => (
              <div key={expense.expense_id} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {expense.description || expense.category}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {expense.category} • {new Date(expense.expense_date).toLocaleDateString()}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#dc2626' }}>
                  ${Number(expense.amount).toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
