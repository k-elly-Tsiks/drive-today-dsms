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

interface BillingItem {
  quotation_id: string
  learner_id: string | null
  learner_name?: string | null
  training_type: string
  driving_class: string | null
  number_of_lessons: number
  total_amount: number
  created_at: string
  document_type?: 'quotation' | 'invoice'
  include_registration?: boolean
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

// ── Skeleton Loader ────────────────────────────────────────────────────────
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

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('billing')
  const [billingFilter, setBillingFilter] = useState('all') // 'all', 'quotation', 'invoice'
  
  const [payments, setPayments] = useState<Payment[]>([])
  const [billings, setBillings] = useState<BillingItem[]>([])
  const [priceList, setPriceList] = useState<PriceItem[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  // Modals
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false) // General record payment
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  
  const [editingBilling, setEditingBilling] = useState<BillingItem | null>(null)
  const [activeInvoice, setActiveInvoice] = useState<BillingItem | null>(null)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  
  // Derived state to ensure we always have the freshest joined data for the modal
  const currentInvoice = activeInvoice 
    ? (billings.find(b => b.quotation_id === activeInvoice.quotation_id) || activeInvoice)
    : null

  // Quotation Form State
  const [billSelectedLearnerId, setBillSelectedLearnerId] = useState('')
  const [billManualName, setBillManualName] = useState('')
  const [billTrainingType, setBillTrainingType] = useState('')
  const [billDrivingClass, setBillDrivingClass] = useState('')
  const [billNumLessons, setBillNumLessons] = useState('')
  const [billIncludeReg, setBillIncludeReg] = useState(true) // Ticked by default
  const [generatingBill, setGeneratingBill] = useState(false)
  
  // Invoice / Payment Form State
  const [billPaymentAmount, setBillPaymentAmount] = useState('')
  const [billPaymentMethod, setBillPaymentMethod] = useState('cash')
  const [billTransactionRef, setBillTransactionRef] = useState('')
  const [recordingInvoicePayment, setRecordingInvoicePayment] = useState(false)

  // General Record Payment Form State
  const [selectedLearner, setSelectedLearner] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transactionRef, setTransactionRef] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Edit Payment State
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentMethod, setEditPaymentMethod] = useState('')
  const [editTransactionRef, setEditTransactionRef] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  // Price list editing
  const [editingPrice, setEditingPrice] = useState<PriceItem | null>(null)
  const [newPrice, setNewPrice] = useState('')
  const [updatingPrice, setUpdatingPrice] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Design tokens
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const primary = '#3b82f6'
  const orange = '#f97316'
  const green = '#10b981'
  const danger = '#ef4444'

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`*, learner:users!payments_learner_id_fkey (first_name, surname, email)`)
      .order('payment_date', { ascending: false })

    const { data: quotationsData, error: qErr } = await supabase
      .from('quotations')
      .select(`*, learner:users!quotations_learner_id_fkey (first_name, surname, email)`)
      .order('created_at', { ascending: false })
      
    if (qErr) console.error("Error fetching billings:", qErr)

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
    setBillings((quotationsData as BillingItem[]) || [])
    setPriceList(priceData || [])
    setLearners(learnersData || [])
    setLoading(false)
  }, [])

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }
    const { data } = await supabase.from('users').select('role').eq('user_id', user.id).single()
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

  const computedBillTotal = (() => {
    let total = 0
    if (billTrainingType && billNumLessons) {
      const price = priceList.find(p =>
        p.training_type === billTrainingType &&
        (billTrainingType === 'Provisional' || p.driving_class === billDrivingClass)
      )
      if (price) total += price.price_per_lesson * parseInt(billNumLessons)
    }
    if (billIncludeReg) {
      const regPrice = priceList.find(p => p.training_type === 'Registration Fee')
      total += regPrice ? regPrice.price_per_lesson : 20 
    }
    return total
  })()

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  function getLearnerBalance(learnerId: string) {
    const totalPaid = payments.filter(p => p.learner_id === learnerId).reduce((sum, p) => sum + Number(p.amount), 0)
    const totalInvoiced = billings.filter(b => b.learner_id === learnerId && b.document_type === 'invoice').reduce((sum, b) => sum + Number(b.total_amount), 0)
    return { totalPaid, totalInvoiced, balance: totalInvoiced - totalPaid }
  }

  const filteredBillings = billings.filter(b => billingFilter === 'all' || b.document_type === billingFilter)

  const handleStatClick = (label: string) => {
    if (label === 'Total Revenue' || label === 'Total Payments') {
      setActiveTab('payments')
    } else if (label === 'Total Invoices') {
      setActiveTab('billing')
      setBillingFilter('invoice')
    } else if (label === 'Pending Quotations') {
      setActiveTab('billing')
      setBillingFilter('quotation')
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  function downloadBilling(bill: BillingItem) {
    const learnerName = bill.learner ? `${bill.learner.first_name} ${bill.learner.surname}` : bill.learner_name || 'N/A'
    const learnerEmail = bill.learner?.email || ''
    const date = new Date(bill.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const isInvoice = bill.document_type === 'invoice'
    
    let regFee = 0
    if (bill.include_registration) {
      const p = priceList.find(x => x.training_type === 'Registration Fee')
      regFee = p ? p.price_per_lesson : 20
    }
    
    const lessonsCost = Number(bill.total_amount) - regFee
    const pricePerLesson = bill.number_of_lessons > 0 ? (lessonsCost / bill.number_of_lessons).toFixed(2) : '0.00'

    const learnerPayments = bill.learner_id ? payments.filter(p => p.learner_id === bill.learner_id) : []
    const totalPaid = learnerPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balanceDue = Number(bill.total_amount) - totalPaid

    const paymentsHtml = isInvoice && learnerPayments.length > 0 ? `
      <div style="margin-top: 32px;">
        <div class="section-title" style="margin-bottom: 12px; color: #1e293b;">PAYMENT HISTORY</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th style="text-align:right">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            ${learnerPayments.map(p => `
              <tr>
                <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                <td style="text-transform: capitalize;">${p.payment_method}</td>
                <td>${p.transaction_ref || '—'}</td>
                <td style="text-align:right;font-weight:600;color:#059669;">+$${Number(p.amount).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f8fafc">
              <td colspan="3" style="text-align:right;font-weight:700">Total Paid:</td>
              <td style="text-align:right;font-weight:800;color:#059669">$${totalPaid.toFixed(2)}</td>
            </tr>
            <tr style="background:${balanceDue > 0 ? '#fef2f2' : '#f0fdf4'}">
              <td colspan="3" style="text-align:right;font-weight:700">Balance Due:</td>
              <td style="text-align:right;font-weight:800;color:${balanceDue > 0 ? '#dc2626' : '#16a34a'}">$${balanceDue > 0 ? balanceDue.toFixed(2) : '0.00'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ` : ''

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${isInvoice ? 'Invoice' : 'Quotation'} — ${learnerName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#111827;padding:48px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
  .logo{font-size:28px;font-weight:900;color:#1e293b}
  .logo span{color:#3b82f6}
  .badge{background:${isInvoice ? '#059669' : '#1e293b'};color:white;padding:6px 18px;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase}
  hr{border:none;border-top:2px solid #e2e8f0;margin:24px 0}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
  .section-title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .val{font-size:14px;font-weight:600;color:#1e293b}
  .lbl{font-size:12px;color:#64748b}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#f8fafc;text-align:left;padding:10px 14px;font-size:11px;font-weight:700;color:#1e293b;text-transform:uppercase}
  td{padding:12px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;color:#334155}
  .total-row{background:#1e293b}
  .total-row td{font-weight:800;font-size:16px;color:white}
  .note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-size:12px;color:#475569;line-height:1.6}
  .footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:48px}
</style></head><body>
<div class="header">
  <div>
    <div class="logo">Drive<span>Today</span></div>
    <div class="lbl" style="margin-top:4px">159 Manresa Way, Harare, Zimbabwe</div>
  </div>
  <div style="text-align:right">
    <div class="badge">${isInvoice ? 'INVOICE' : 'QUOTATION'}</div>
    <div class="lbl" style="margin-top:8px">Date: ${date}</div>
    <div class="lbl">Ref: ${isInvoice ? 'INV' : 'QT'}-${bill.quotation_id.slice(0, 8).toUpperCase()}</div>
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
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>
    ${bill.include_registration ? `
    <tr>
      <td>Student Registration Fee</td>
      <td>—</td>
      <td style="text-align:center">1</td>
      <td style="text-align:right">$${regFee.toFixed(2)}</td>
      <td style="text-align:right;font-weight:700">$${regFee.toFixed(2)}</td>
    </tr>` : ''}
    <tr>
      <td>${bill.training_type} Training</td>
      <td>${bill.driving_class || '—'}</td>
      <td style="text-align:center">${bill.number_of_lessons} Lessons</td>
      <td style="text-align:right">$${pricePerLesson}</td>
      <td style="text-align:right;font-weight:700">$${lessonsCost.toFixed(2)}</td>
    </tr>
  </tbody>
  <tfoot><tr class="total-row">
    <td colspan="4">Document Total</td>
    <td style="text-align:right">$${Number(bill.total_amount).toFixed(2)}</td>
  </tr></tfoot>
</table>

${paymentsHtml}

<div class="note" style="margin-top: 32px;">
  <strong>Payment Terms:</strong> Payment is due upon commencement of lessons.
  We accept Cash, EcoCash and Bank Transfer.
  Please quote your reference number when making payment.
</div>
<div class="footer">
  Thank you for choosing Drive Today Driving School.<br/>
  ${isInvoice ? 'Please keep this invoice for your records.' : 'This quotation is valid for 30 days from the date of issue.'}
</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  async function saveQuotation(action: 'save' | 'open_invoice') {
    if (!billSelectedLearnerId && !billManualName.trim()) { setError('Please select a learner or enter a name.'); return }
    if (!billTrainingType || !billNumLessons) { setError('Please fill in training type and number of lessons.'); return }
    if (billTrainingType === 'Driving Class' && !billDrivingClass) { setError('Please select a driving class.'); return }
    if (computedBillTotal === 0) { setError('Could not calculate total. Please check the price list.'); return }
    
    setGeneratingBill(true); setError('')

    const learnerName = billSelectedLearnerId ? null : billManualName.trim()
    const learnerId = billSelectedLearnerId || null

    const payload: Record<string, unknown> = {
      training_type: billTrainingType,
      driving_class: billDrivingClass || null,
      number_of_lessons: parseInt(billNumLessons),
      include_registration: billIncludeReg,
      total_amount: computedBillTotal,
      learner_id: learnerId,
      learner_name: learnerName,
      document_type: action === 'open_invoice' ? 'invoice' : (editingBilling ? editingBilling.document_type : 'quotation') 
    }

    let savedBillingDoc = null

    if (editingBilling) {
      const { data, error: updateError } = await supabase.from('quotations').update(payload).eq('quotation_id', editingBilling.quotation_id).select().single()
      if (updateError) { setError('Failed to update document: ' + updateError.message); setGeneratingBill(false); return }
      savedBillingDoc = data
      setSuccessMessage('Details updated successfully.')
    } else {
      const { data, error: insertError } = await supabase.from('quotations').insert(payload).select().single()
      if (insertError) { setError('Failed to generate document: ' + insertError.message); setGeneratingBill(false); return }
      savedBillingDoc = data
      setSuccessMessage(action === 'open_invoice' ? 'Invoice generated successfully.' : 'Quotation generated successfully.')
    }

    setTimeout(() => setSuccessMessage(''), 4000)
    
    setShowQuotationModal(false)
    setEditingBilling(null)
    setGeneratingBill(false)
    setBillingFilter('all') 
    
    await loadData() 
    
    if (action === 'open_invoice' && savedBillingDoc) {
      setTimeout(() => {
        setActiveInvoice(savedBillingDoc as BillingItem)
        setBillPaymentAmount('')
        setBillTransactionRef('')
        setShowInvoiceModal(true)
      }, 100)
    }
  }

  async function recordInvoicePayment() {
    if (!currentInvoice?.learner_id) {
      setError('Cannot record payment for a manual walk-in. Please register the learner first.');
      return;
    }
    if (parseFloat(billPaymentAmount || '0') <= 0) { setError('Payment amount must be greater than zero.'); return }
    if (!billPaymentMethod) { setError('Please select a payment method.'); return }

    setRecordingInvoicePayment(true); setError('')

    const { error: paymentError } = await supabase.from('payments').insert({
      learner_id: currentInvoice.learner_id,
      amount: parseFloat(billPaymentAmount),
      payment_method: billPaymentMethod,
      transaction_ref: billTransactionRef || null,
    })

    if (paymentError) { setError('Failed to record payment: ' + paymentError.message); setRecordingInvoicePayment(false); return }

    await supabase.from('notifications').insert({
      recipient_id: currentInvoice.learner_id,
      message: `Payment of $${parseFloat(billPaymentAmount).toFixed(2)} has been recorded against your invoice.`,
      type: 'payment',
    })

    if (currentInvoice.document_type === 'quotation') {
       await supabase.from('quotations').update({ document_type: 'invoice' }).eq('quotation_id', currentInvoice.quotation_id)
       setActiveInvoice(prev => prev ? { ...prev, document_type: 'invoice' } : null)
    }

    setSuccessMessage(`Payment of $${parseFloat(billPaymentAmount).toFixed(2)} recorded successfully!`)
    setTimeout(() => setSuccessMessage(''), 4000)
    
    setBillPaymentAmount('')
    setBillTransactionRef('')
    setRecordingInvoicePayment(false)
    setBillingFilter('all')
    
    await loadData()
  }

  async function deleteBilling() {
    if (!editingBilling) return
    if (!confirm('Are you sure you want to completely delete this billing document?')) return
    
    setGeneratingBill(true)
    const { error: delError } = await supabase.from('quotations').delete().eq('quotation_id', editingBilling.quotation_id)
    if (delError) { setError('Failed to delete.'); setGeneratingBill(false); return }
    
    setSuccessMessage('Document deleted.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowQuotationModal(false); setEditingBilling(null); setGeneratingBill(false); loadData()
  }

  async function recordPayment() {
    if (!selectedLearner || !paymentAmount || !paymentMethod) { setError('Please fill in all required fields.'); return }
    if (parseFloat(paymentAmount) <= 0) { setError('Payment amount must be greater than zero.'); return }
    setRecordingPayment(true); setError('')

    const { error: insertError } = await supabase.from('payments').insert({
      learner_id: selectedLearner, amount: parseFloat(paymentAmount),
      payment_method: paymentMethod, transaction_ref: transactionRef || null,
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
    setShowPaymentModal(false); setSelectedLearner(''); setPaymentAmount(''); setPaymentMethod('cash'); setTransactionRef('')
    setRecordingPayment(false); loadData()
  }

  async function saveEditPayment() {
    if (!editingPayment || !editPaymentAmount || !editPaymentMethod) { setError('Please fill in all required fields.'); return }
    if (parseFloat(editPaymentAmount) <= 0) { setError('Amount must be greater than zero.'); return }
    setSavingPayment(true); setError('')

    const { error: updateError } = await supabase.from('payments').update({
      amount: parseFloat(editPaymentAmount), payment_method: editPaymentMethod, transaction_ref: editTransactionRef || null,
    }).eq('payment_id', editingPayment.payment_id)

    if (updateError) { setError('Failed to update payment.'); setSavingPayment(false); return }

    setSuccessMessage('Payment updated successfully.'); setTimeout(() => setSuccessMessage(''), 3000)
    setShowEditPaymentModal(false); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMethod(''); setEditTransactionRef('')
    setSavingPayment(false); loadData()
  }

  async function updatePrice() {
    if (!newPrice || parseFloat(newPrice) <= 0) { setError('Please enter a valid price.'); return }
    if (!editingPrice) { setError('No price selected.'); return }
    setUpdatingPrice(true); setError('')

    const { error: updateError } = await supabase.from('price_list')
      .update({ price_per_lesson: parseFloat(newPrice), updated_at: new Date().toISOString() })
      .eq('price_id', editingPrice.price_id)

    if (updateError) { setError('Failed to update price.'); setUpdatingPrice(false); return }

    setSuccessMessage('Price updated successfully.'); setTimeout(() => setSuccessMessage(''), 3000)
    setEditingPrice(null); setNewPrice(''); setUpdatingPrice(false); loadData()
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>💰 Payments & Billing</h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>Manage payments, invoices, quotations and pricing</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => { 
                setEditingBilling(null); setBillSelectedLearnerId(''); setBillManualName(''); 
                setBillTrainingType(''); setBillDrivingClass(''); setBillNumLessons(''); setBillIncludeReg(true);
                setShowQuotationModal(true); setError('') 
              }} 
              style={{ 
                padding: '10px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', 
                background: 'white', color: textDark, fontSize: '13px', 
                fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' 
              }}
            >
              📋 Create Quotation
            </button>
            <button 
              onClick={() => { setShowPaymentModal(true); setError('') }} 
              style={{ 
                padding: '10px 18px', borderRadius: '8px', border: 'none', 
                background: green, color: 'white', fontSize: '13px', 
                fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' 
              }}
            >
              + Record Payment
            </button>
          </div>
        </div>

        {/* Success / Error */}
        {successMessage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
            ✅ {successMessage}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>
            ❌ {error}
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {loading ? (
             Array(4).fill(0).map((_, i) => (
               <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <Skeleton h="28px" w="60px" r="6px" />
                 <div style={{ marginTop: '8px' }}><Skeleton h="11px" w="70%" r="4px" /></div>
               </div>
             ))
          ) : (
            [
              { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, colour: green },
              { label: 'Total Payments', value: payments.length, colour: primary },
              { label: 'Total Invoices', value: billings.filter(b => b.document_type === 'invoice').length, colour: orange },
              { label: 'Pending Quotations', value: billings.filter(b => b.document_type === 'quotation').length, colour: textMuted },
            ].map((stat, i) => (
              <div 
                key={i} 
                onClick={() => handleStatClick(stat.label)}
                style={{ 
                  background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                  borderLeft: `3px solid ${stat.colour}`, cursor: 'pointer', transition: 'transform 0.15s'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark }}>{stat.value}</p>
                <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>{stat.label}</p>
              </div>
            ))
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '10px', padding: '6px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', width: 'fit-content' }}>
          {[{ id: 'billing', label: '🧾 Billing (Quotes & Invoices)' }, { id: 'payments', label: '💰 Payments Made' }, { id: 'pricelist', label: '🏷 Price List' }].map(tab => (
            <button 
              key={tab.id} onClick={() => { setActiveTab(tab.id); setBillingFilter('all') }} 
              style={{ 
                padding: '8px 16px', borderRadius: '6px', border: 'none', 
                background: activeTab === tab.id ? textDark : 'transparent', 
                color: activeTab === tab.id ? 'white' : textMuted, 
                fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' 
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
           <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
             <Skeleton w="100%" h="40px" r="6px" />
             <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <Skeleton w="100%" h="60px" r="8px" />
               <Skeleton w="100%" h="60px" r="8px" />
               <Skeleton w="100%" h="60px" r="8px" />
             </div>
           </div>
        ) : (
          <>
            {/* ── BILLING TAB (COMBINED QUOTES & INVOICES) ── */}
            {activeTab === 'billing' && (
              <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['all', 'quotation', 'invoice'].map(f => (
                    <button
                      key={f} onClick={() => setBillingFilter(f)}
                      style={{
                        padding: '6px 14px', borderRadius: '20px', border: billingFilter === f ? 'none' : '1px solid #e2e8f0',
                        background: billingFilter === f ? textDark : 'white', color: billingFilter === f ? 'white' : textMuted,
                        fontSize: '12px', fontWeight: '700', textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {f}s
                    </button>
                  ))}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr 1fr 2fr', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Type', 'Learner', 'Details', 'Total', 'Date', 'Actions'].map((h, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
                  ))}
                </div>
                
                {filteredBillings.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '32px', marginBottom: '12px' }}>🧾</p>
                    <p style={{ color: textDark, fontSize: '14px', fontWeight: '600' }}>No billing documents found</p>
                    <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>Create a new quotation to get started.</p>
                  </div>
                ) : (
                  filteredBillings.map((bill) => (
                    <div key={bill.quotation_id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr 1fr 2fr', padding: '16px 20px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                      
                      <div>
                        <span style={{ 
                          background: bill.document_type === 'invoice' ? '#dcfce7' : '#f1f5f9', 
                          color: bill.document_type === 'invoice' ? '#16a34a' : '#475569', 
                          padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', border: `1px solid ${bill.document_type === 'invoice' ? '#bbf7d0' : '#e2e8f0'}`
                        }}>
                          {bill.document_type === 'invoice' ? 'Invoice' : 'Quote'}
                        </span>
                      </div>

                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: textDark }}>
                          {bill.learner ? `${bill.learner.first_name} ${bill.learner.surname}` : bill.learner_name || '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>{bill.learner?.email || 'Manual Entry'}</p>
                      </div>

                      <div>
                        <p style={{ margin: 0, fontSize: '13px', color: textDark, fontWeight: '500' }}>{bill.training_type} {bill.driving_class ? `(${bill.driving_class})` : ''}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>{bill.number_of_lessons} Lessons {bill.include_registration ? '+ Reg Fee' : ''}</p>
                      </div>

                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: green }}>${Number(bill.total_amount).toFixed(2)}</p>
                      
                      <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>{new Date(bill.created_at).toLocaleDateString()}</p>
                      
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => downloadBilling(bill)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => {
                            setActiveInvoice(bill)
                            setBillPaymentAmount('')
                            setBillTransactionRef('')
                            setShowInvoiceModal(true)
                            setError('')
                          }}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: primary, color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                          View / Pay
                        </button>
                        <button
                          onClick={() => {
                            setEditingBilling(bill)
                            setBillSelectedLearnerId(bill.learner_id || '')
                            setBillManualName(bill.learner_id ? '' : (bill.learner_name || ''))
                            setBillTrainingType(bill.training_type)
                            setBillDrivingClass(bill.driving_class || '')
                            setBillNumLessons(bill.number_of_lessons.toString())
                            setBillIncludeReg(bill.include_registration || false)
                            setShowQuotationModal(true)
                            setError('')
                          }}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── PAYMENTS TAB ── */}
            {activeTab === 'payments' && (
              <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Learner', 'Amount', 'Method', 'Reference', 'Date', 'Actions'].map((h, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
                  ))}
                </div>
                {payments.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '32px', margin: '0 0 12px' }}>💰</p>
                    <p style={{ color: textDark, fontSize: '14px', fontWeight: '600' }}>No payments recorded yet</p>
                    <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>Use the Record Payment button to add one.</p>
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.payment_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: textDark }}>{payment.learner?.first_name} {payment.learner?.surname}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>{payment.learner?.email}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: green }}>${Number(payment.amount).toFixed(2)}</p>
                      <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: textDark, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', width: 'fit-content' }}>
                        {payment.payment_method}
                      </span>
                      <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>{payment.transaction_ref || '—'}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>{new Date(payment.payment_date).toLocaleDateString()}</p>
                      <button
                        onClick={() => {
                          setEditingPayment(payment)
                          setEditPaymentAmount(payment.amount.toString())
                          setEditPaymentMethod(payment.payment_method)
                          setEditTransactionRef(payment.transaction_ref || '')
                          setError('')
                          setShowEditPaymentModal(true)
                        }}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '700', cursor: 'pointer', width: 'fit-content', transition: 'background 0.2s' }}
                      >
                        Edit
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── PRICE LIST TAB ── */}
            {activeTab === 'pricelist' && (
              <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Training Type', 'Driving Class', 'Price', 'Actions'].map((h, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
                  ))}
                </div>
                {priceList.map((price) => (
                  <div key={price.price_id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: textDark }}>{price.training_type}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>{price.driving_class || '—'}</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: green }}>${Number(price.price_per_lesson).toFixed(2)}</p>
                    <button
                      onClick={() => { setEditingPrice(price); setNewPrice(price.price_per_lesson.toString()); setError('') }}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '700', cursor: 'pointer', width: 'fit-content', transition: 'background 0.2s' }}
                    >
                      Edit Price
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CREATE / EDIT QUOTATION MODAL ── */}
        {showQuotationModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '500px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: 0 }}>
                  {editingBilling ? 'Edit Details' : 'Create Quotation'}
                </h2>
                {editingBilling && (
                  <button onClick={deleteBilling} style={{ background: '#fef2f2', color: danger, border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    Delete
                  </button>
                )}
              </div>

              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: danger, fontSize: '13px', fontWeight: '600' }}>{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>

                {/* Learner Selection / Manual Entry */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Learner Details *</label>
                  
                  <select 
                    value={billSelectedLearnerId} 
                    onChange={e => {
                      setBillSelectedLearnerId(e.target.value)
                      if (e.target.value) setBillManualName('')
                    }} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Select Registered Learner --</option>
                    {learners.map(l => <option key={l.user_id} value={l.user_id}>{l.first_name} {l.surname}</option>)}
                  </select>
                  
                  <div style={{ textAlign: 'center', fontSize: '11px', color: textMuted, margin: '12px 0', fontWeight: '700' }}>OR</div>
                  
                  <input 
                    type="text" 
                    value={billManualName} 
                    onChange={(e) => {
                      setBillManualName(e.target.value)
                      if (e.target.value) setBillSelectedLearnerId('')
                    }} 
                    placeholder="Enter walk-in name manually" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

                {/* Training Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Training Type *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['Provisional', 'Driving Class'].map(type => (
                      <button key={type} type="button" onClick={() => { setBillTrainingType(type); setBillDrivingClass('') }}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: billTrainingType === type ? 'none' : '1px solid #e2e8f0', background: billTrainingType === type ? textDark : 'white', color: billTrainingType === type ? 'white' : textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Driving Class */}
                {billTrainingType === 'Driving Class' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Driving Class *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {['Class 1', 'Class 2', 'Class 3', 'Class 4'].map(cls => (
                        <button key={cls} type="button" onClick={() => setBillDrivingClass(cls)}
                          style={{ padding: '10px', borderRadius: '8px', border: billDrivingClass === cls ? 'none' : '1px solid #e2e8f0', background: billDrivingClass === cls ? textDark : 'white', color: billDrivingClass === cls ? 'white' : textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Number of Lessons */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Number of Lessons *</label>
                  <input type="number" min="1" value={billNumLessons} onChange={(e) => setBillNumLessons(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Include Registration Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <input type="checkbox" id="regFee" checked={billIncludeReg} onChange={(e) => setBillIncludeReg(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <label htmlFor="regFee" style={{ fontSize: '14px', fontWeight: '600', color: textDark, cursor: 'pointer', flex: 1 }}>
                    Include Registration Fee?
                  </label>
                </div>

                {/* Calculated total */}
                {computedBillTotal > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>Calculated Total</p>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: green }}>${computedBillTotal.toFixed(2)}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#16a34a', fontWeight: '500' }}>
                      {billNumLessons} lessons {billIncludeReg ? '+ Registration' : ''}
                    </p>
                  </div>
                )}

              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => { setShowQuotationModal(false); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textMuted, fontSize: '14px', fontWeight: '600', cursor: 'pointer', minWidth: '100px' }}>Cancel</button>
                <button onClick={() => saveQuotation('save')} disabled={generatingBill} style={{ flex: 1.5, padding: '12px', borderRadius: '8px', border: `1px solid ${primary}`, background: 'white', color: primary, fontSize: '14px', fontWeight: '700', cursor: generatingBill ? 'not-allowed' : 'pointer', minWidth: '130px' }}>
                  {generatingBill ? 'Saving...' : 'Save Quotation'}
                </button>
                <button onClick={() => saveQuotation('open_invoice')} disabled={generatingBill} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: generatingBill ? '#cbd5e1' : primary, color: 'white', fontSize: '14px', fontWeight: '700', cursor: generatingBill ? 'not-allowed' : 'pointer', minWidth: '160px' }}>
                  {generatingBill ? 'Saving...' : 'Save & Open Invoice'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── INVOICE / PAYMENT MODAL (Opened after save or by clicking a row) ── */}
        {showInvoiceModal && currentInvoice && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '460px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>Invoice & Payment</h2>
                  <p style={{ color: textMuted, fontSize: '14px', margin: 0, fontWeight: '500' }}>
                    {currentInvoice.learner ? `${currentInvoice.learner.first_name} ${currentInvoice.learner.surname}` : currentInvoice.learner_name}
                  </p>
                </div>
                <button 
                  onClick={() => downloadBilling(currentInvoice)} 
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  Download PDF
                </button>
              </div>

              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: danger, fontSize: '13px', fontWeight: '600' }}>{error}</div>}

              {/* Balance Summary */}
              {currentInvoice.learner_id ? (() => {
                const balance = getLearnerBalance(currentInvoice.learner_id)
                const thisDocTotal = Number(currentInvoice.total_amount)
                
                return (
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: textMuted, fontWeight: '600' }}>Document Total:</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: textDark }}>${thisDocTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '13px', color: textMuted, fontWeight: '600' }}>Total Paid by Learner:</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: green }}>${balance.totalPaid.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: textDark, fontWeight: '700' }}>Balance Due:</span>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: balance.balance > 0 ? danger : green }}>${balance.balance > 0 ? balance.balance.toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                )
              })() : (
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: textMuted, fontWeight: '600' }}>Document Total:</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: textDark }}>${Number(currentInvoice.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Payment History inside Invoice */}
              {currentInvoice.learner_id && (() => {
                const learnerPayments = payments.filter(p => p.learner_id === currentInvoice.learner_id)
                if (learnerPayments.length > 0) {
                  return (
                    <div style={{ background: 'white', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <h3 style={{ color: textDark, fontSize: '14px', fontWeight: '700', margin: '0 0 16px' }}>Payment History</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {learnerPayments.map(p => (
                          <div key={p.payment_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '12px', borderBottom: '1px solid #f8fafc' }}>
                            <span style={{ color: textMuted, fontWeight: '500' }}>{new Date(p.payment_date).toLocaleDateString()} - <span style={{textTransform:'capitalize'}}>{p.payment_method}</span></span>
                            <span style={{ fontWeight: '700', color: green }}>+${Number(p.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Record Payment Form */}
              {currentInvoice.learner_id ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ color: '#16a34a', fontSize: '14px', fontWeight: '700', margin: '0 0 16px' }}>➕ Add New Payment</h3>
                  
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#16a34a', marginBottom: '6px', fontWeight: '600' }}>Amount Paid</label>
                      <input type="number" min="0" step="0.01" value={billPaymentAmount} onChange={(e) => setBillPaymentAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #86efac', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#16a34a', marginBottom: '6px', fontWeight: '600' }}>Method</label>
                      <select value={billPaymentMethod} onChange={e => setBillPaymentMethod(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #86efac', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="cash">Cash</option>
                        <option value="EcoCash">EcoCash</option>
                        <option value="bank transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#16a34a', marginBottom: '6px', fontWeight: '600' }}>Reference (optional)</label>
                    <input type="text" value={billTransactionRef} onChange={(e) => setBillTransactionRef(e.target.value)} placeholder="e.g. ECO-1234..." style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #86efac', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  
                  <button 
                    onClick={recordInvoicePayment} 
                    disabled={recordingInvoicePayment} 
                    style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', fontSize: '14px', fontWeight: '700', cursor: recordingInvoicePayment ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                  >
                    {recordingInvoicePayment ? 'Saving...' : 'Record Payment Now'}
                  </button>
                </div>
              ) : (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#92400e', marginBottom: '24px', lineHeight: '1.5' }}>
                  💡 <strong>Note:</strong> This is a manual walk-in. To record a payment, the learner must be registered in the system first.
                </div>
              )}

              <button 
                onClick={() => { setShowInvoiceModal(false); setActiveInvoice(null); setError('') }} 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textMuted, fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                Close Window
              </button>
            </div>
          </div>
        )}

        {/* ── GENERAL RECORD PAYMENT MODAL ── */}
        {showPaymentModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '460px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 24px' }}>Record Payment</h2>
              
              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: danger, fontSize: '13px', fontWeight: '600' }}>{error}</div>}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Learner *</label>
                  <select value={selectedLearner} onChange={(e) => setSelectedLearner(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select learner...</option>
                    {learners.map(l => <option key={l.user_id} value={l.user_id}>{l.first_name} {l.surname}</option>)}
                  </select>
                </div>
                
                {selectedLearner && (() => {
                  const balance = getLearnerBalance(selectedLearner)
                  return (
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: textMuted, fontWeight: '600' }}>Total Invoiced:</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: textDark }}>${balance.totalInvoiced.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '13px', color: textMuted, fontWeight: '600' }}>Total Paid:</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: green }}>${balance.totalPaid.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: textDark }}>Outstanding Balance:</span>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: balance.balance > 0 ? danger : green }}>${balance.balance.toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })()}
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Payment Amount ($) *</label>
                  <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Payment Method *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    {['cash', 'EcoCash', 'bank transfer'].map(method => (
                      <button key={method} type="button" onClick={() => setPaymentMethod(method)} style={{ padding: '10px 8px', borderRadius: '8px', border: paymentMethod === method ? 'none' : '1px solid #e2e8f0', background: paymentMethod === method ? textDark : 'white', color: paymentMethod === method ? 'white' : textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                        {method === 'bank transfer' ? 'Transfer' : method.charAt(0).toUpperCase() + method.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Transaction Reference (optional)</label>
                  <input type="text" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. ECO-123456789" style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowPaymentModal(false); setSelectedLearner(''); setPaymentAmount(''); setPaymentMethod('cash'); setTransactionRef(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textMuted, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={recordPayment} disabled={recordingPayment} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: recordingPayment ? '#cbd5e1' : green, color: 'white', fontSize: '14px', fontWeight: '700', cursor: recordingPayment ? 'not-allowed' : 'pointer' }}>
                  {recordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT PAYMENT MODAL ── */}
        {showEditPaymentModal && editingPayment && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '440px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>Edit Payment</h2>
              <p style={{ color: textMuted, fontSize: '14px', margin: '0 0 24px', fontWeight: '500' }}>
                {editingPayment.learner?.first_name} {editingPayment.learner?.surname}
              </p>
              
              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: danger, fontSize: '13px', fontWeight: '600' }}>{error}</div>}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Payment Amount ($) *</label>
                  <input type="number" min="0.01" step="0.01" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Payment Method *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    {['cash', 'EcoCash', 'bank transfer'].map(method => (
                      <button key={method} type="button" onClick={() => setEditPaymentMethod(method)} style={{ padding: '10px 8px', borderRadius: '8px', border: editPaymentMethod === method ? 'none' : '1px solid #e2e8f0', background: editPaymentMethod === method ? textDark : 'white', color: editPaymentMethod === method ? 'white' : textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                         {method === 'bank transfer' ? 'Transfer' : method.charAt(0).toUpperCase() + method.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Transaction Reference (optional)</label>
                  <input type="text" value={editTransactionRef} onChange={(e) => setEditTransactionRef(e.target.value)} placeholder="e.g. ECO-123456789" style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowEditPaymentModal(false); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMethod(''); setEditTransactionRef(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textMuted, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveEditPayment} disabled={savingPayment} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: savingPayment ? '#cbd5e1' : primary, color: 'white', fontSize: '14px', fontWeight: '700', cursor: savingPayment ? 'not-allowed' : 'pointer' }}>
                  {savingPayment ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT PRICE MODAL ── */}
        {editingPrice && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>Edit Price</h2>
              <p style={{ color: textMuted, fontSize: '14px', margin: '0 0 24px', fontWeight: '500' }}>
                {editingPrice.training_type} {editingPrice.driving_class ? `(${editingPrice.driving_class})` : ''}
              </p>
              
              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: danger, fontSize: '13px', fontWeight: '600' }}>{error}</div>}

              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Price Per Lesson ($) *</label>
                <input type="number" min="0.01" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setEditingPrice(null); setNewPrice(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: textMuted, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={updatePrice} disabled={updatingPrice} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: updatingPrice ? '#cbd5e1' : textDark, color: 'white', fontSize: '14px', fontWeight: '700', cursor: updatingPrice ? 'not-allowed' : 'pointer' }}>
                  {updatingPrice ? 'Saving...' : 'Save Price'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
