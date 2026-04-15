'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Learner {
  user_id: string
  first_name: string
  surname: string
  email: string
}

interface Payment {
  payment_id: string
  learner_id: string
  amount: number
  payment_method: string
  transaction_ref: string | null
  payment_date: string
  learner?: Learner
}

interface Quotation {
  quotation_id: string
  learner_id: string | null
  learner_name?: string | null
  training_type: string
  driving_class: string | null
  number_of_lessons: number
  total_amount: number
  created_at: string
  learner?: Learner
}

interface PriceItem {
  price_id: string
  training_type: string
  driving_class: string | null
  price_per_lesson: number
  updated_at: string
}

const supabase = createClient()

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('payments')
  const [payments, setPayments] = useState<Payment[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [priceList, setPriceList] = useState<PriceItem[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  // Record payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedLearner, setSelectedLearner] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Edit payment modal
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentMethod, setEditPaymentMethod] = useState('')
  const [editTransactionRef, setEditTransactionRef] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  // Quotation modal
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [quoteManualName, setQuoteManualName] = useState('')
  const [quoteTrainingType, setQuoteTrainingType] = useState('')
  const [quoteDrivingClass, setQuoteDrivingClass] = useState('')
  const [quoteNumLessons, setQuoteNumLessons] = useState('')
  const [generatingQuote, setGeneratingQuote] = useState(false)

  // Price list editing
  const [editingPrice, setEditingPrice] = useState<PriceItem | null>(null)
  const [newPrice, setNewPrice] = useState('')
  const [updatingPrice, setUpdatingPrice] = useState(false)

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
      .select(`*, learner:users!payments_learner_id_fkey (first_name, surname, email)`)
      .order('payment_date', { ascending: false })

    const { data: quotationsData } = await supabase
      .from('quotations')
      .select(`*, learner:users!quotations_learner_id_fkey (first_name, surname, email)`)
      .order('created_at', { ascending: false })

    const { data: priceData } = await supabase
      .from('price_list')
      .select('*')
      .order('training_type', { ascending: true })

    const { data: learnersData } = await supabase
      .from('users')
      .select('user_id, first_name, surname, email')
      .eq('role', 'learner')
      .eq('status', 'approved')
      .order('first_name', { ascending: true })

    setPayments(paymentsData || [])
    setQuotations(quotationsData || [])
    setPriceList(priceData || [])
    setLearners(learnersData || [])
    setLoading(false)
  }, [])

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }
    const { data } = await supabase
      .from('users').select('role').eq('user_id', user.id).single()
    if (data?.role !== 'admin') { routerRef.current.push('/login'); return }
    await loadData()
  }, [loadData])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await checkAdmin() }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  // ─── Computed values ──────────────────────────────────────────────────────────

  const computedQuoteTotal = (() => {
    if (quoteTrainingType && quoteNumLessons) {
      const price = priceList.find(p =>
        p.training_type === quoteTrainingType &&
        (quoteTrainingType === 'Provisional' || p.driving_class === quoteDrivingClass)
      )
      return price ? price.price_per_lesson * parseInt(quoteNumLessons) : 0
    }
    return 0
  })()

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  function getLearnerBalance(learnerId: string) {
    const totalPaid = payments.filter(p => p.learner_id === learnerId)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const totalQuoted = quotations.filter(q => q.learner_id === learnerId)
      .reduce((sum, q) => sum + Number(q.total_amount), 0)
    return { totalPaid, totalQuoted, balance: totalQuoted - totalPaid }
  }

  // ─── Download quotation as PDF ────────────────────────────────────────────────

  function downloadQuotation(quote: Quotation) {
    const learnerName = quote.learner
      ? `${quote.learner.first_name} ${quote.learner.surname}`
      : quote.learner_name || 'N/A'
    const learnerEmail = quote.learner?.email || ''
    const date = new Date(quote.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const pricePerLesson = quote.number_of_lessons > 0
      ? (Number(quote.total_amount) / quote.number_of_lessons).toFixed(2)
      : '0.00'

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Quotation — ${learnerName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#111827;padding:48px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
  .logo{font-size:28px;font-weight:900;color:#1e3a8a}
  .logo span{color:#f97316}
  .badge{background:#1e3a8a;color:white;padding:6px 18px;border-radius:20px;font-size:13px;font-weight:700}
  hr{border:none;border-top:2px solid #e5e7eb;margin:24px 0}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
  .section-title{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .val{font-size:14px;font-weight:600;color:#111827}
  .lbl{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#f0f4ff;text-align:left;padding:10px 14px;font-size:11px;font-weight:700;color:#1e3a8a;text-transform:uppercase}
  td{padding:12px 14px;font-size:13px;border-bottom:1px solid #f3f4f6}
  .total-row{background:#1e3a8a}
  .total-row td{font-weight:800;font-size:16px;color:white}
  .note{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:12px;color:#92400e;line-height:1.6}
  .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:48px}
  @media print{body{padding:24px}}
</style></head><body>
<div class="header">
  <div>
    <div class="logo">Drive<span>Today</span></div>
    <div class="lbl" style="margin-top:4px">159 Manresa Way, Harare, Zimbabwe</div>
  </div>
  <div style="text-align:right">
    <div class="badge">QUOTATION</div>
    <div class="lbl" style="margin-top:8px">Date: ${date}</div>
    <div class="lbl">Ref: QT-${quote.quotation_id.slice(0, 8).toUpperCase()}</div>
  </div>
</div>
<hr/>
<div class="two-col">
  <div>
    <div class="section-title">Prepared for</div>
    <div class="val">${learnerName}</div>
    ${learnerEmail ? `<div class="lbl" style="margin-top:4px">${learnerEmail}</div>` : ''}
  </div>
  <div>
    <div class="section-title">Prepared by</div>
    <div class="val">Drive Today Driving School</div>
    <div class="lbl" style="margin-top:4px">Admin Office</div>
  </div>
</div>
<table>
  <thead><tr>
    <th>Description</th><th>Class</th>
    <th style="text-align:center">Lessons</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">Total</th>
  </tr></thead>
  <tbody><tr>
    <td>${quote.training_type} Training</td>
    <td>${quote.driving_class || '—'}</td>
    <td style="text-align:center">${quote.number_of_lessons}</td>
    <td style="text-align:right">$${pricePerLesson}</td>
    <td style="text-align:right;font-weight:700">$${Number(quote.total_amount).toFixed(2)}</td>
  </tr></tbody>
  <tfoot><tr class="total-row">
    <td colspan="4">Total Amount Due</td>
    <td style="text-align:right">$${Number(quote.total_amount).toFixed(2)}</td>
  </tr></tfoot>
</table>
<div class="note">
  <strong>Payment Terms:</strong> Payment is due upon commencement of lessons.
  We accept Cash, EcoCash and Bank Transfer.
  Please quote your reference number when making payment.
</div>
<div class="footer">
  Thank you for choosing Drive Today Driving School.<br/>
  This quotation is valid for 30 days from the date of issue.
</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async function recordPayment() {
    if (!selectedLearner || !paymentAmount || !paymentMethod) {
      setError('Please fill in all required fields.'); return
    }
    if (parseFloat(paymentAmount) <= 0) {
      setError('Payment amount must be greater than zero.'); return
    }
    setRecordingPayment(true); setError('')

    const { error: insertError } = await supabase.from('payments').insert({
      learner_id: selectedLearner,
      amount: parseFloat(paymentAmount),
      payment_method: paymentMethod,
      transaction_ref: transactionRef || null,
    })

    if (insertError) { setError('Failed to record payment.'); setRecordingPayment(false); return }

    const learner = learners.find(l => l.user_id === selectedLearner)
    await supabase.from('notifications').insert({
      recipient_id: selectedLearner,
      message: `Payment of $${parseFloat(paymentAmount).toFixed(2)} has been recorded via ${paymentMethod}.`,
      type: 'payment',
    })

    setSuccessMessage(`Payment of $${parseFloat(paymentAmount).toFixed(2)} recorded for ${learner?.first_name} ${learner?.surname}.`)
    setTimeout(() => setSuccessMessage(''), 4000)
    setShowPaymentModal(false)
    setSelectedLearner(''); setPaymentAmount(''); setPaymentMethod(''); setTransactionRef('')
    setRecordingPayment(false)
    loadData()
  }

  async function saveEditPayment() {
    if (!editingPayment || !editPaymentAmount || !editPaymentMethod) {
      setError('Please fill in all required fields.'); return
    }
    if (parseFloat(editPaymentAmount) <= 0) {
      setError('Amount must be greater than zero.'); return
    }
    setSavingPayment(true); setError('')

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        amount: parseFloat(editPaymentAmount),
        payment_method: editPaymentMethod,
        transaction_ref: editTransactionRef || null,
      })
      .eq('payment_id', editingPayment.payment_id)

    if (updateError) { setError('Failed to update payment.'); setSavingPayment(false); return }

    setSuccessMessage('Payment updated successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowEditPaymentModal(false); setEditingPayment(null)
    setEditPaymentAmount(''); setEditPaymentMethod(''); setEditTransactionRef('')
    setSavingPayment(false)
    loadData()
  }

  async function generateQuotation() {
    if (!quoteManualName.trim() || !quoteTrainingType || !quoteNumLessons) {
      setError('Please fill in all required fields.'); return
    }
    if (quoteTrainingType === 'Driving Class' && !quoteDrivingClass) {
      setError('Please select a driving class.'); return
    }
    if (computedQuoteTotal === 0) {
      setError('Could not calculate total. Please check the price list.'); return
    }
    setGeneratingQuote(true); setError('')

    const payload: Record<string, unknown> = {
      training_type: quoteTrainingType,
      driving_class: quoteDrivingClass || null,
      number_of_lessons: parseInt(quoteNumLessons),
      total_amount: computedQuoteTotal,
      learner_name: quoteManualName.trim(),
    }

    const { data: newQuote, error: insertError } = await supabase
      .from('quotations').insert(payload).select().single()

    if (insertError) { setError('Failed to generate quotation.'); setGeneratingQuote(false); return }

    const displayName = quoteManualName.trim()

    setSuccessMessage(`Quotation of $${computedQuoteTotal.toFixed(2)} generated for ${displayName}.`)
    setTimeout(() => setSuccessMessage(''), 4000)

    if (newQuote) {
      downloadQuotation({ ...newQuote, learner_name: quoteManualName.trim() })
    }

    setShowQuotationModal(false)
    setQuoteManualName(''); setQuoteTrainingType('')
    setQuoteDrivingClass(''); setQuoteNumLessons('')
    setGeneratingQuote(false)
    loadData()
  }

  async function updatePrice() {
    if (!newPrice || parseFloat(newPrice) <= 0) { setError('Please enter a valid price.'); return }
    if (!editingPrice) { setError('No price selected.'); return }
    setUpdatingPrice(true); setError('')

    const { error: updateError } = await supabase
      .from('price_list')
      .update({ price_per_lesson: parseFloat(newPrice), updated_at: new Date().toISOString() })
      .eq('price_id', editingPrice.price_id)

    if (updateError) { setError('Failed to update price.'); setUpdatingPrice(false); return }

    setSuccessMessage('Price updated successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setEditingPrice(null); setNewPrice(''); setUpdatingPrice(false)
    loadData()
  }

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px', fontWeight: '800', color: 'white',
          }}>DT</div>
          <p style={{ color: blue, fontWeight: '600' }}>Loading Payments...</p>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>💰 Payments & Quotations</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Manage payments, quotations and pricing</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => { setShowQuotationModal(true); setError('') }} style={{ padding: '10px 18px', borderRadius: '10px', border: `2px solid ${blue}`, background: 'white', color: blue, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            📋 Generate Quotation
          </button>
          <button onClick={() => { setShowPaymentModal(true); setError('') }} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${blue}, ${orange})`, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + Record Payment
          </button>
          <button onClick={() => router.push('/admin/dashboard')} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: blue, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            ← Dashboard
          </button>
        </div>
      </div>

      {/* Success / Error */}
      {successMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>
          ✅ {successMessage}
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
          ❌ {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, colour: '#059669' },
          { label: 'Total Payments', value: payments.length, colour: blue },
          { label: 'Quotations Generated', value: quotations.length, colour: orange },
          { label: 'Approved Learners', value: learners.length, colour: '#7c3aed' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${stat.colour}` }}>
            <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {[{ id: 'payments', label: '💰 Payments' }, { id: 'quotations', label: '📋 Quotations' }, { id: 'pricelist', label: '🏷 Price List' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent', color: activeTab === tab.id ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PAYMENTS TAB ── */}
      {activeTab === 'payments' && (
        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr', padding: '12px 20px', background: lightBlue, borderBottom: '1px solid #e5e7eb' }}>
            {['Learner', 'Amount', 'Method', 'Reference', 'Date', 'Actions'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: blue, textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>
          {payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>💰</p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No payments recorded yet</p>
            </div>
          ) : (
            payments.map((payment, index) => (
              <div key={payment.payment_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{payment.learner?.first_name} {payment.learner?.surname}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{payment.learner?.email}</p>
                </div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#059669' }}>${Number(payment.amount).toFixed(2)}</p>
                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', width: 'fit-content' }}>
                  {payment.payment_method}
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{payment.transaction_ref || '—'}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{new Date(payment.payment_date).toLocaleDateString()}</p>
                {/* Edit button */}
                <button
                  onClick={() => {
                    setEditingPayment(payment)
                    setEditPaymentAmount(payment.amount.toString())
                    setEditPaymentMethod(payment.payment_method)
                    setEditTransactionRef(payment.transaction_ref || '')
                    setError('')
                    setShowEditPaymentModal(true)
                  }}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: '700', cursor: 'pointer', width: 'fit-content' }}
                >
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── QUOTATIONS TAB ── */}
      {activeTab === 'quotations' && (
        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: lightBlue, borderBottom: '1px solid #e5e7eb' }}>
            {['Learner', 'Training Type', 'Class', 'Lessons', 'Total', 'Date', 'Download'].map((h, i) => (
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
              <div key={quote.quotation_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {quote.learner ? `${quote.learner.first_name} ${quote.learner.surname}` : quote.learner_name || '—'}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{quote.learner?.email || ''}</p>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>{quote.training_type}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>{quote.driving_class || '—'}</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>{quote.number_of_lessons}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#059669' }}>${Number(quote.total_amount).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{new Date(quote.created_at).toLocaleDateString()}</p>
                <button
                  onClick={() => downloadQuotation(quote)}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: '700', cursor: 'pointer', width: 'fit-content' }}
                >
                  ⬇ PDF
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── PRICE LIST TAB ── */}
      {activeTab === 'pricelist' && (
        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '12px 20px', background: lightBlue, borderBottom: '1px solid #e5e7eb' }}>
            {['Training Type', 'Driving Class', 'Price Per Lesson', 'Actions'].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: blue, textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>
          {priceList.map((price, index) => (
            <div key={price.price_id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{price.training_type}</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>{price.driving_class || '—'}</p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#059669' }}>${Number(price.price_per_lesson).toFixed(2)}</p>
              <button
                onClick={() => { setEditingPrice(price); setNewPrice(price.price_per_lesson.toString()); setError('') }}
                style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: `linear-gradient(135deg, ${blue}, ${orange})`, color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', width: 'fit-content' }}
              >
                Edit Price
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ── */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>Record Payment</h2>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Learner *</label>
                <select value={selectedLearner} onChange={(e) => setSelectedLearner(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }}>
                  <option value="">Select learner...</option>
                  {learners.map(l => <option key={l.user_id} value={l.user_id}>{l.first_name} {l.surname}</option>)}
                </select>
              </div>
              {selectedLearner && (() => {
                const balance = getLearnerBalance(selectedLearner)
                return (
                  <div style={{ background: lightBlue, borderRadius: '10px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: '#374151' }}>Total Quoted:</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: blue }}>${balance.totalQuoted.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#374151' }}>Total Paid:</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>${balance.totalPaid.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(30,58,138,0.1)' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>Outstanding Balance:</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: balance.balance > 0 ? '#dc2626' : '#059669' }}>${balance.balance.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })()}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Payment Amount ($) *</label>
                <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Payment Method *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['cash', 'EcoCash', 'bank transfer'].map(method => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)} style={{ flex: 1, padding: '10px 8px', borderRadius: '10px', border: paymentMethod === method ? 'none' : '1px solid #e5e7eb', background: paymentMethod === method ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: paymentMethod === method ? 'white' : '#6b7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Transaction Reference (optional)</label>
                <input type="text" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. ECO-123456789" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowPaymentModal(false); setSelectedLearner(''); setPaymentAmount(''); setPaymentMethod(''); setTransactionRef(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={recordPayment} disabled={recordingPayment} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: recordingPayment ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: recordingPayment ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: recordingPayment ? 'not-allowed' : 'pointer' }}>
                {recordingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PAYMENT MODAL ── */}
      {showEditPaymentModal && editingPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>Edit Payment</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>
              {editingPayment.learner?.first_name} {editingPayment.learner?.surname}
            </p>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Payment Amount ($) *</label>
                <input type="number" min="0.01" step="0.01" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Payment Method *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['cash', 'EcoCash', 'bank transfer'].map(method => (
                    <button key={method} type="button" onClick={() => setEditPaymentMethod(method)} style={{ flex: 1, padding: '10px 8px', borderRadius: '10px', border: editPaymentMethod === method ? 'none' : '1px solid #e5e7eb', background: editPaymentMethod === method ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: editPaymentMethod === method ? 'white' : '#6b7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Transaction Reference (optional)</label>
                <input type="text" value={editTransactionRef} onChange={(e) => setEditTransactionRef(e.target.value)} placeholder="e.g. ECO-123456789" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowEditPaymentModal(false); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMethod(''); setEditTransactionRef(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditPayment} disabled={savingPayment} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: savingPayment ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: savingPayment ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: savingPayment ? 'not-allowed' : 'pointer' }}>
                {savingPayment ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GENERATE QUOTATION MODAL ── */}
      {showQuotationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '460px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>Generate Quotation</h2>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>

              {/* Learner name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Learner Name *</label>
                <input type="text" value={quoteManualName} onChange={(e) => setQuoteManualName(e.target.value)} placeholder="e.g. John Doe" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
              </div>

              {/* Training Type */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Training Type *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Provisional', 'Driving Class'].map(type => (
                    <button key={type} type="button" onClick={() => { setQuoteTrainingType(type); setQuoteDrivingClass('') }}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: quoteTrainingType === type ? 'none' : '1px solid #e5e7eb', background: quoteTrainingType === type ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: quoteTrainingType === type ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Driving Class */}
              {quoteTrainingType === 'Driving Class' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Driving Class *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Class 1', 'Class 2', 'Class 3', 'Class 4'].map(cls => (
                      <button key={cls} type="button" onClick={() => setQuoteDrivingClass(cls)}
                        style={{ padding: '8px 14px', borderRadius: '20px', border: quoteDrivingClass === cls ? 'none' : '1px solid #e5e7eb', background: quoteDrivingClass === cls ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: quoteDrivingClass === cls ? 'white' : '#6b7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Number of Lessons */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Number of Lessons *</label>
                <input type="number" min="1" value={quoteNumLessons} onChange={(e) => setQuoteNumLessons(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
              </div>

              {/* Calculated total */}
              {computedQuoteTotal > 0 && (
                <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#065f46' }}>Calculated Total</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#059669' }}>${computedQuoteTotal.toFixed(2)}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#065f46' }}>
                    {quoteNumLessons} lessons × ${(computedQuoteTotal / parseInt(quoteNumLessons || '1')).toFixed(2)} per lesson
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowQuotationModal(false); setQuoteManualName(''); setQuoteTrainingType(''); setQuoteDrivingClass(''); setQuoteNumLessons(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={generateQuotation} disabled={generatingQuote} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: generatingQuote ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: generatingQuote ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: generatingQuote ? 'not-allowed' : 'pointer' }}>
                {generatingQuote ? 'Generating...' : '📋 Generate & Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PRICE MODAL ── */}
      {editingPrice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '380px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Edit Price</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>
              {editingPrice.training_type}{editingPrice.driving_class ? ` — ${editingPrice.driving_class}` : ''}
            </p>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>New Price Per Lesson ($)</label>
              <input type="number" min="0.01" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', fontWeight: '700', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setEditingPrice(null); setNewPrice(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={updatePrice} disabled={updatingPrice} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: updatingPrice ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: updatingPrice ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: updatingPrice ? 'not-allowed' : 'pointer' }}>
                {updatingPrice ? 'Updating...' : 'Update Price'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
