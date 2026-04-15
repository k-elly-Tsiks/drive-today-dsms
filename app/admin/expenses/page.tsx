'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Expense {
  expense_id: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  recorded_by: string
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [recording, setRecording] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Form fields
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const router = useRouter()
  const supabase = createClient()

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const categories = [
    { id: 'fuel', label: 'Fuel', icon: '⛽' },
    { id: 'vehicle_maintenance', label: 'Vehicle Maintenance', icon: '🔧' },
    { id: 'office_supplies', label: 'Office Supplies', icon: '📎' },
    { id: 'insurance', label: 'Insurance', icon: '🛡' },
    { id: 'utilities', label: 'Utilities', icon: '💡' },
    { id: 'other', label: 'Other', icon: '📦' },
  ]

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

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    checkAdmin()
  }, [checkAdmin])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
      if (isMounted) {
        setExpenses(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [supabase])

  async function recordExpense() {
    if (!category || !amount || !expenseDate) {
      setError('Please fill in all required fields.')
      return
    }

    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    setRecording(true)
    setError('')

    // Get current admin id
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('expenses')
      .insert({
        category,
        amount: parseFloat(amount),
        description: description || null,
        expense_date: expenseDate,
        recorded_by: user?.id,
      })

    if (error) {
      setError('Failed to record expense.')
      setRecording(false)
      return
    }

    setSuccessMessage(`Expense of $${parseFloat(amount).toFixed(2)} recorded successfully.`)
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowModal(false)
    setCategory('')
    setAmount('')
    setDescription('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setRecording(false)
    loadExpenses()
  }

  async function deleteExpense(expenseId: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('expense_id', expenseId)

    if (error) {
      setError('Failed to delete expense.')
      setTimeout(() => setError(''), 3000)
      return
    }

    setSuccessMessage('Expense deleted.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadExpenses()
  }

  // Filter and search
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch =
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filterCategory === 'all' || e.category === filterCategory
    return matchesSearch && matchesFilter
  })

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const thisMonthExpenses = expenses
    .filter(e => {
      const expDate = new Date(e.expense_date)
      const now = new Date()
      return (
        expDate.getMonth() === now.getMonth() &&
        expDate.getFullYear() === now.getFullYear()
      )
    })
    .reduce((sum, e) => sum + Number(e.amount), 0)

  function getCategoryIcon(cat: string) {
    return categories.find(c => c.id === cat)?.icon || '📦'
  }

  function getCategoryLabel(cat: string) {
    return categories.find(c => c.id === cat)?.label || cat
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
        <p style={{ color: blue, fontWeight: '600' }}>Loading Expenses...</p>
      </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            🧾 Expenses
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Record and track all school expenses
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setShowModal(true); setError('') }}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              border: 'none',
              background: `linear-gradient(135deg, ${blue}, ${orange})`,
              color: 'white', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            + Record Expense
          </button>
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
      </div>
      {/* Success / Error */}
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total Expenses', value: `$${totalExpenses.toFixed(2)}`, colour: '#dc2626' },
          { label: 'This Month', value: `$${thisMonthExpenses.toFixed(2)}`, colour: orange },
          { label: 'Total Records', value: expenses.length, colour: blue },
          {
            label: 'Fuel',
            value: `$${expenses.filter(e => e.category === 'fuel').reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`,
            colour: '#059669'
          },
          {
            label: 'Maintenance',
            value: `$${expenses.filter(e => e.category === 'vehicle_maintenance').reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`,
            colour: '#7c3aed'
          },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: '12px',
            padding: '16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${stat.colour}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800', color: stat.colour }}>
              {stat.value}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: '0 0 14px' }}>
          Expenses by Category
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {categories.map(cat => {
            const catTotal = expenses
              .filter(e => e.category === cat.id)
              .reduce((s, e) => s + Number(e.amount), 0)
            return (
              <div key={cat.id} style={{
                background: lightBlue, borderRadius: '10px',
                padding: '10px 16px', textAlign: 'center',
                minWidth: '120px',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: '20px' }}>{cat.icon}</p>
                <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '800', color: blue }}>
                  ${catTotal.toFixed(2)}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                  {cat.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Search and Filter */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '16px 20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '12px',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="🔍 Search by description or category..."
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
          <button
            onClick={() => setFilterCategory('all')}
            style={{
              padding: '8px 14px', borderRadius: '20px',
              border: filterCategory === 'all' ? 'none' : '1px solid #e5e7eb',
              background: filterCategory === 'all'
                ? `linear-gradient(135deg, ${blue}, ${orange})`
                : 'white',
              color: filterCategory === 'all' ? 'white' : '#6b7280',
              fontSize: '12px', fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                border: filterCategory === cat.id ? 'none' : '1px solid #e5e7eb',
                background: filterCategory === cat.id
                  ? `linear-gradient(135deg, ${blue}, ${orange})`
                  : 'white',
                color: filterCategory === cat.id ? 'white' : '#6b7280',
                fontSize: '12px', fontWeight: filterCategory === cat.id ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Table */}
      <div style={{
        background: 'white', borderRadius: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr 3fr 1fr 1fr',
          padding: '12px 20px',
          background: lightBlue,
          borderBottom: '1px solid #e5e7eb',
        }}>
          {['Category', 'Amount', 'Description', 'Date', 'Actions'].map((h, i) => (
            <p key={i} style={{
              margin: 0, fontSize: '11px',
              fontWeight: '700', color: blue,
              textTransform: 'uppercase',
            }}>
              {h}
            </p>
          ))}
        </div>

        {filteredExpenses.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</p>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>
              No expenses recorded yet
            </p>
          </div>
        ) : (
          filteredExpenses.map((expense, index) => (
            <div
              key={expense.expense_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 3fr 1fr 1fr',
                padding: '14px 20px',
                borderBottom: '1px solid #f3f4f6',
                background: index % 2 === 0 ? 'white' : '#fafafa',
                alignItems: 'center',
              }}
            >
              {/* Category */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>
                  {getCategoryIcon(expense.category)}
                </span>
                <span style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>
                  {getCategoryLabel(expense.category)}
                </span>
              </div>

              {/* Amount */}
              <p style={{
                margin: 0, fontSize: '15px',
                fontWeight: '800', color: '#dc2626',
              }}>
                ${Number(expense.amount).toFixed(2)}
              </p>

              {/* Description */}
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                {expense.description || '—'}
              </p>

              {/* Date */}
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                {new Date(expense.expense_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>

              {/* Delete */}
              <button
                onClick={() => deleteExpense(expense.expense_id)}
                style={{
                  padding: '5px 10px', borderRadius: '6px',
                  border: 'none', background: '#fee2e2',
                  color: '#991b1b', fontSize: '11px',
                  fontWeight: '700', cursor: 'pointer',
                  width: 'fit-content',
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}

        {/* Table Footer Total */}
        {filteredExpenses.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 3fr 1fr 1fr',
            padding: '14px 20px',
            background: lightBlue,
            borderTop: '2px solid #e5e7eb',
          }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: blue }}>
              TOTAL
            </p>
            <p style={{
              margin: 0, fontSize: '15px',
              fontWeight: '800', color: '#dc2626',
            }}>
              ${filteredExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}
            </p>
            <p style={{ margin: 0 }} />
            <p style={{ margin: 0 }} />
            <p style={{ margin: 0 }} />
          </div>
        )}
      </div>

      {/* ── RECORD EXPENSE MODAL ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '20px',
            padding: '32px', width: '100%',
            maxWidth: '440px', margin: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>
              Record Expense
            </h2>

            {error && (
              <div style={{
                background: '#fee2e2', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#991b1b', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Category */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '8px',
                }}>
                  Category *
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: category === cat.id
                          ? 'none'
                          : '1px solid #e5e7eb',
                        background: category === cat.id
                          ? `linear-gradient(135deg, ${blue}, ${orange})`
                          : 'white',
                        color: category === cat.id ? 'white' : '#6b7280',
                        fontSize: '12px', fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  Amount ($) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '14px', outline: 'none',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Fuel for vehicle ZIM 123A"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                    resize: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Date */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                  }}
                />
              </div>

            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  setShowModal(false)
                  setCategory('')
                  setAmount('')
                  setDescription('')
                  setExpenseDate(new Date().toISOString().split('T')[0])
                  setError('')
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  color: '#374151', fontSize: '14px',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={recordExpense}
                disabled={recording}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px',
                  border: 'none',
                  background: recording
                    ? '#e5e7eb'
                    : `linear-gradient(135deg, ${blue}, ${orange})`,
                  color: recording ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: recording ? 'not-allowed' : 'pointer',
                }}
              >
                {recording ? 'Recording...' : 'Record Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}