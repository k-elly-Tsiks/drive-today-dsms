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
  const [isDarkMode, setIsDarkMode] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Sync theme state with layout
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const theme = {
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    hoverBg: isDarkMode ? '#1e2433' : '#f8fafc',
  }

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
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.textMain, fontWeight: '600' }}>Loading Payments...</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: theme.textMain }}>

      {/* Subpage description */}
      <div style={{ marginBottom: '4px' }}>
        <p style={{ color: theme.textMuted, fontSize: '14px', margin: 0 }}>View your payment history and quotations</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total Quoted',        value: `$${totalQuoted.toFixed(2)}`,  icon: '📋', colour: isDarkMode ? orange : blue },
          { label: 'Total Paid',          value: `$${totalPaid.toFixed(2)}`,    icon: '💰', colour: '#059669' },
          { label: 'Outstanding Balance', value: `$${outstanding.toFixed(2)}`,  icon: '🧾', colour: outstanding > 0 ? '#dc2626' : '#059669' },
          { label: 'Total Payments',      value: payments.length,               icon: '📄', colour: orange },
        ].map((stat, i) => (
          <div key={i} style={{ background: theme.cardBg, borderRadius: '14px', padding: '20px', border: `1px solid ${theme.border}`, borderTop: `4px solid ${stat.colour}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>{stat.label}</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
              </div>
              <span style={{ fontSize: '28px' }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Balance alerts */}
      {outstanding > 0 && (
        <div style={{ background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fee2e2', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.2)' : '#fca5a5'}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#f87171' : '#991b1b', fontWeight: '600' }}>
            You have an outstanding balance of <strong>${outstanding.toFixed(2)}</strong>. Please contact the administrator to make a payment.
          </p>
        </div>
      )}
      {outstanding === 0 && totalPaid > 0 && (
        <div style={{ background: isDarkMode ? 'rgba(16,185,129,0.1)' : '#d1fae5', border: `1px solid ${isDarkMode ? 'rgba(16,185,129,0.2)' : '#6ee7b7'}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#34d399' : '#065f46', fontWeight: '600' }}>Your account is fully paid up. No outstanding balance.</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: theme.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${theme.border}`, width: 'fit-content' }}>
        {[
          { id: 'statement',  label: '💰 Payment History' },
          { id: 'quotations', label: '📋 Quotations' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent', color: activeTab === tab.id ? 'white' : theme.textMuted, fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PAYMENT HISTORY TAB ── */}
      {activeTab === 'statement' && (
        <div style={{ background: theme.cardBg, borderRadius: '14px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '12px 20px', background: isDarkMode ? '#1e2433' : lightBlue, borderBottom: `1px solid ${theme.border}` }}>
            {['Amount', 'Method', 'Reference', 'Date'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: isDarkMode ? orange : blue, textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>

          {payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>💰</p>
              <p style={{ color: theme.textMuted, fontSize: '14px' }}>No payments recorded yet</p>
            </div>
          ) : (
            <>
              {payments.map((payment, index) => (
                <div key={payment.payment_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, background: index % 2 === 0 ? theme.cardBg : theme.hoverBg, alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#059669' }}>${Number(payment.amount).toFixed(2)}</p>
                  <div>{paymentMethodBadge(payment.payment_method)}</div>
                  <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>{payment.transaction_ref || '—'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>
                    {new Date(payment.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '14px 20px', background: isDarkMode ? '#1e2433' : lightBlue, borderTop: `2px solid ${theme.border}` }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#059669' }}>${totalPaid.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: isDarkMode ? orange : blue }}>TOTAL PAID</p>
                <p style={{ margin: 0 }} />
                <p style={{ margin: 0 }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QUOTATIONS TAB ── */}
      {activeTab === 'quotations' && (
        <div style={{ background: theme.cardBg, borderRadius: '14px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 20px', background: isDarkMode ? '#1e2433' : lightBlue, borderBottom: `1px solid ${theme.border}` }}>
            {['Training Type', 'Lessons', 'Total Amount', 'Date'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: isDarkMode ? orange : blue, textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>

          {quotations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
              <p style={{ color: theme.textMuted, fontSize: '14px' }}>No quotations generated yet</p>
            </div>
          ) : (
            quotations.map((quote, index) => (
              <div key={quote.quotation_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, background: index % 2 === 0 ? theme.cardBg : theme.hoverBg, alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: theme.textMain }}>{quote.training_type}</p>
                  {quote.driving_class && <p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>{quote.driving_class}</p>}
                </div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: isDarkMode ? orange : blue }}>{quote.number_of_lessons}</p>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#059669' }}>${Number(quote.total_amount).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>
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
