'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, ClipboardList, CreditCard, FileText, Receipt, Wallet } from 'lucide-react'
import { amountDue, invoicedTotal, lessonFeesTotal, paidTotal } from '@/lib/fees'

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
  document_type?: string | null
}

type LessonCharge = {
  booking_id: string
  status: string
  lesson_fee: number | null
  lesson_slots?: { slot_date: string; slot_time: string } | null
}

// 1. Shimmer Skeleton Component
function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: r,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s infinite linear',
    }} />
  )
}

const supabase = createClient()

export default function LearnerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [lessonCharges, setLessonCharges] = useState<LessonCharge[]>([])
  const [chargesError, setChargesError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('charges')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e293b'
  const orange = '#ff5a00'
  const lightBlue = '#fff2eb'

  // Insert keyframes dynamically for shimmer animation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const styleId = 'skeleton-shimmer-styles'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.innerHTML = `
          @keyframes skeleton-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `
        document.head.appendChild(style)
      }
    }
  }, [])


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

    const { data: chargesData, error: chargesLoadError } = await supabase
      .from('lesson_bookings')
      .select('booking_id, status, lesson_fee, lesson_slots (slot_date, slot_time)')
      .eq('learner_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    setPayments(paymentsData || [])
    setQuotations(quotationsData || [])
    setLessonCharges((chargesData || []) as unknown as LessonCharge[])
    setChargesError(chargesLoadError ? 'Lesson fees are not available yet. Ask the administrator to finish the fees setup.' : '')
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

  const totalPaid = paidTotal(payments)
  const totalLessonFees = lessonFeesTotal(lessonCharges)
  const totalInvoiced = invoicedTotal(quotations)
  const outstanding = amountDue(totalLessonFees, totalInvoiced, totalPaid)

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

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Header */}
      <div className="learner-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>My Payments</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Your lesson fees, payments and amount due</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <Skeleton w="60%" h="12px" r="4px" />
                  <Skeleton w="40%" h="24px" r="4px" />
                </div>
                <Skeleton w="28px" h="28px" r="6px" />
              </div>
            </div>
          ))
        ) : (
          [
            { label: 'Lesson Fees',         value: `$${totalLessonFees.toFixed(2)}`, icon: <ClipboardList size={18} color="#2563eb" />, colour: '#2563eb', badgeBg: '#eff6ff' },
            { label: 'Total Paid',          value: `$${totalPaid.toFixed(2)}`,    icon: <Wallet size={18} color="#059669" />, colour: '#059669', badgeBg: '#f0fdf4' },
            { label: 'Amount Due',          value: `$${outstanding.toFixed(2)}`,  icon: <Receipt size={18} color={outstanding > 0 ? '#dc2626' : '#059669'} />, colour: outstanding > 0 ? '#dc2626' : '#059669', badgeBg: outstanding > 0 ? '#fff1f2' : '#f0fdf4' },
            { label: 'Total Payments',      value: payments.length,               icon: <CreditCard size={18} color={orange} />, colour: orange, badgeBg: '#fff2eb' },
          ].map((stat, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{stat.label}</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
                </div>
                <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: stat.badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Balance alerts */}
      {!loading && outstanding > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} color="#dc2626" />
          <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
            You have an outstanding balance of <strong>${outstanding.toFixed(2)}</strong>. Please contact the administrator to make a payment.
          </p>
        </div>
      )}
      {!loading && outstanding === 0 && totalPaid > 0 && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle size={18} color="#059669" />
          <p style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: '600' }}>Your account is fully paid up. No outstanding balance.</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {[
          { id: 'charges',    label: 'Lesson Charges', icon: <Receipt size={15} /> },
          { id: 'statement',  label: 'Payment History', icon: <CreditCard size={15} /> },
          { id: 'quotations', label: 'Quotations', icon: <ClipboardList size={15} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? orange : 'transparent', color: activeTab === tab.id ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', gap: '20px', padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
              <Skeleton w="50px" h="16px" r="4px" />
              <Skeleton w="60px" h="14px" r="10px" />
              <Skeleton w="120px" h="14px" r="4px" />
              <Skeleton w="70px" h="14px" r="4px" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── LESSON CHARGES TAB ── */}
          {activeTab === 'charges' && (
            <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 20px', background: lightBlue, borderBottom: '1px solid #e5e7eb' }}>
                {['Lesson', 'Status', 'Fee'].map((h, i) => (
                  <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: blue, textTransform: 'uppercase' }}>{h}</p>
                ))}
              </div>

              {chargesError ? (
                <p style={{ margin: 0, padding: '24px 20px', fontSize: '13px', color: '#991b1b' }}>{chargesError}</p>
              ) : lessonCharges.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <Receipt size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
                  <p style={{ color: '#9ca3af', fontSize: '14px' }}>No lessons booked yet</p>
                </div>
              ) : (
                <>
                  {lessonCharges.map((charge, index) => (
                    <div key={charge.booking_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                        {charge.lesson_slots?.slot_date
                          ? `${new Date(charge.lesson_slots.slot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${charge.lesson_slots.slot_time?.slice(0, 5)}`
                          : 'Lesson'}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>{charge.status}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: blue }}>
                        {charge.lesson_fee === null ? 'To be confirmed' : `$${Number(charge.lesson_fee).toFixed(2)}`}
                      </p>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '14px 20px', background: lightBlue, borderTop: '2px solid #e5e7eb' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: blue }}>TOTAL LESSON FEES ({lessonCharges.length} lesson{lessonCharges.length === 1 ? '' : 's'})</p>
                    <p style={{ margin: 0 }} />
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: blue }}>${totalLessonFees.toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>
          )}

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
                  <CreditCard size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
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
                  <FileText size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
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
        </>
      )}

    </div>
  )
}
