'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Payment = {
  payment_id: string
  amount: number
  payment_method: string
  transaction_ref: string | null
  payment_date: string
}

type Quotation = {
  quotation_id: string
  training_type: string
  driving_class?: string | null
  number_of_lessons: number
  total_amount: number
  created_at: string
}

const supabase = createClient()

export default function LearnerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('statement')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('learner_id', user.id)
      .order('payment_date', { ascending: false })

    const { data: quotationsData } = await supabase
      .from('quotations')
      .select('*')
      .eq('learner_id', user.id)
      .order('created_at', { ascending: false })

    setPayments(paymentsData || [])
    setQuotations(quotationsData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadData()
    }
    init()
    return () => { cancelled = true }
  }, [loadData])

  // ─── Derived values ───────────────────────────────────────────────────────────

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const totalQuoted = quotations.reduce((s, q) => s + Number(q.total_amount), 0)
  const outstanding = Math.max(0, totalQuoted - totalPaid)

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function paymentMethodBadge(method: string) {
    const styles: Record<string, { background: string; color: string }> = {
      cash: { background: '#d1fae5', color: '#065f46' },
      EcoCash: { background: '#ede9fe', color: '#5b21b6' },
      'bank transfer': { background: '#dbeafe', color: '#1e40af' },
    }
    return (
      <span style={{
        ...(styles[method] ?? styles.cash),
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700',
      }}>
        {method}
      </span>
    )
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Payments...</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>💰 My Payments</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>View your payment history and quotations</p>
        </div>
        <button
          onClick={() => router.push('/learner/dashboard')}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: blue, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          ← Dashboard
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Quoted',        value: `$${totalQuoted.toFixed(2)}`,  icon: '📋', colour: blue },
          { label: 'Total Paid',          value: `$${totalPaid.toFixed(2)}`,    icon: '💰', colour: '#059669' },
          { label: 'Outstanding Balance', value: `$${outstanding.toFixed(2)}`,  icon: '🧾', colour: outstanding > 0 ? '#dc2626' : '#059669' },
          { label: 'Total Payments',      value: payments.length,               icon: '📄', colour: orange },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${stat.colour}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{stat.label}</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
              </div>
              <span style={{ fontSize: '28px' }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Balance alerts */}
      {outstanding > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
            You have an outstanding balance of <strong>${outstanding.toFixed(2)}</strong>. Please contact the administrator to make a payment.
          </p>
        </div>
      )}
      {outstanding === 0 && totalPaid > 0 && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <p style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: '600' }}>Your account is fully paid up. No outstanding balance.</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {[
          { id: 'statement',  label: '💰 Payment History' },
          { id: 'quotations', label: '📋 Quotations' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent', color: activeTab === tab.id ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PAYMENT HISTORY TAB ── */}
      {activeTab === 'statement' && (
        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '12px 20px', background: lightBlue, borderBottom: '1px solid #e5e7eb' }}>
            {['Amount', 'Method', 'Reference', 'Date'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: blue, textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>

          {payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>💰</p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No payments recorded yet</p>
            </div>
          ) : (
            <>
              {payments.map((payment, index) => (
                <div key={payment.payment_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#059669' }}>${Number(payment.amount).toFixed(2)}</p>
                  <div>{paymentMethodBadge(payment.payment_method)}</div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{payment.transaction_ref || '—'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                    {new Date(payment.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '14px 20px', background: lightBlue, borderTop: '2px solid #e5e7eb' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#059669' }}>${totalPaid.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: blue }}>TOTAL PAID</p>
                <p style={{ margin: 0 }} />
                <p style={{ margin: 0 }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QUOTATIONS TAB ── */}
      {activeTab === 'quotations' && (
        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 20px', background: lightBlue, borderBottom: '1px solid #e5e7eb' }}>
            {['Training Type', 'Lessons', 'Total Amount', 'Date'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: blue, textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>

          {quotations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No quotations generated yet</p>
            </div>
          ) : (
            quotations.map((quote, index) => (
              <div key={quote.quotation_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{quote.training_type}</p>
                  {quote.driving_class && <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{quote.driving_class}</p>}
                </div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>{quote.number_of_lessons}</p>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#059669' }}>${Number(quote.total_amount).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                  {new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  )
}
