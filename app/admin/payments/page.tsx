'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Learner { user_id: string; first_name: string; surname: string; email: string; phone_number?: string }
interface Payment { payment_id: string; learner_id: string; amount: number; payment_method: string; transaction_ref: string | null; payment_date: string; purpose: string; notes: string; learner?: Learner }
interface BillingItem { quotation_id: string; learner_id: string | null; learner_name?: string | null; training_type: string; total_amount: number; number_of_lessons: number; created_at: string; document_type: 'quotation' | 'invoice'; learner?: Learner }
interface PriceItem { price_id: string; item_name: string; amount: number }

function first<T>(val: T | T[] | undefined | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] : val;
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    quotation: { bg: '#f1f5f9', color: '#475569' },
    invoice: { bg: '#e0f2fe', color: '#0369a1' },
    paid: { bg: '#dcfce7', color: '#16a34a' },
  }
  const s = map[status.toLowerCase()] ?? map.quotation
  return (
    <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status}
    </span>
  )
}

// ─── Lucide Icon SVGs ─────────────────────────────────────────────────────────
const Icons = {
  TrendingUp: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>,
  FileText: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>,
  DollarSign: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
  Layers: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>,
  PlusCircle: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])
  const [billings, setBillings] = useState<BillingItem[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [prices, setPrices] = useState<PriceItem[]>([])

  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BillingItem | null>(null)
  const [editingPrice, setEditingPrice] = useState<PriceItem | null>(null)
  

  // Form States
  const [payLearner, setPayLearner] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payPurpose, setPayPurpose] = useState('Driving Class')
  const [payMethod, setPayMethod] = useState('Cash')
  
  const [priceItemName, setPriceItemName] = useState('')
  const [priceAmount, setPriceAmount] = useState('')
  const [quoteLearner, setQuoteLearner] = useState('')
  const [walkInName, setWalkInName] = useState('')
  const [trainingType, setTrainingType] = useState('')
  const [numLessons, setNumLessons] = useState('5')
  const [includeRegFee, setIncludeRegFee] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const calculatedTotal = useMemo(() => {
    const selectedPriceObj = prices.find(p => p.item_name === trainingType);
    const lessonRate = selectedPriceObj ? selectedPriceObj.amount : 0;
    const regPriceObj = prices.find(p => p.item_name.toLowerCase().includes('registration'));
    const registration = includeRegFee && regPriceObj ? regPriceObj.amount : 0;
    const lessons = parseInt(numLessons) || 0;
    return (lessons * lessonRate) + registration;
  }, [numLessons, trainingType, includeRegFee, prices]);

const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [payRes, billRes, learnRes, priceRes] = await Promise.all([
        // 1. Get Payments + Learner info
        supabase.from('payments').select('*, learner:users!payments_learner_id_fkey(*)').order('payment_date', { ascending: false }),
        // 2. Get Quotations + Learner info
        supabase.from('quotations').select('*, learner:users!quotations_learner_id_fkey(*)').order('created_at', { ascending: false }),
        // 3. Get all approved learners for the dropdowns
        supabase.from('users').select('*').eq('role', 'learner').eq('status', 'approved'),
        // 4. Get the real prices from your PRICE_LIST table
        supabase.from('price_list').select('*').order('training_type', { ascending: true })
      ])
      
      setPayments(payRes.data || [])
      setBillings(billRes.data || [])
      setLearners(learnRes.data || [])
      // Map the DB columns (training_type) to the UI state (item_name)
      const mappedPrices = (priceRes.data || []).map(p => ({
        price_id: p.price_id,
        item_name: p.driving_class ? `${p.training_type} (${p.driving_class})` : p.training_type,
        amount: p.price_per_lesson
      }))
      setPrices(mappedPrices)
    } catch (error) {
      console.error("Fetch error:", error)
    } finally {
      setLoading(false)
    }
}, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])
  // ─── Actions ─────────────────────────────────────────────────────────────────

 async function handleSavePrice() {
    if (!priceItemName || !priceAmount) return
    setActionLoading(true)
    
    // Split name if it contains brackets for Class units
    const typeOnly = priceItemName.split(' (')[0];

    const payload = { 
      training_type: typeOnly, 
      price_per_lesson: parseFloat(priceAmount),
      updated_at: new Date().toISOString()
    }

    let error;
    if (editingPrice) {
      const { error: updateError } = await supabase
        .from('price_list') 
        .update(payload)
        .eq('price_id', editingPrice.price_id)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('price_list') 
        .insert(payload)
      error = insertError
    }

    if (!error) {
      dismissPriceModal()
      await loadData()
    }
    setActionLoading(false)
}
 async function handleRecordPayment() {
    if (!payLearner || !payAmount) return
    setActionLoading(true)
    
    try {
      const { error: pErr } = await supabase.from('payments').insert({
        learner_id: payLearner, 
        amount: parseFloat(payAmount), 
        payment_method: payMethod, 
        transaction_ref: payPurpose, 
      })

      if (pErr) throw pErr

      setPayAmount('')
      await loadData() 
      setActiveTab('payments') 
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      console.error("Payment Error:", msg) 
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSaveQuotation(asInvoice: boolean) {
    if ((!quoteLearner && !walkInName) || !trainingType) return
    setActionLoading(true)
    const payload = {
      learner_id: quoteLearner || null,
      learner_name: walkInName || null,
      training_type: trainingType,
      total_amount: calculatedTotal,
      number_of_lessons: parseInt(numLessons) || 0,
      document_type: asInvoice ? 'invoice' : 'quotation'
    }
    const { error } = selectedItem 
        ? await supabase.from('quotations').update(payload).eq('quotation_id', selectedItem.quotation_id)
        : await supabase.from('quotations').insert(payload)

    if (!error) { setShowQuoteModal(false); loadData(); setActiveTab(asInvoice ? 'invoices' : 'quotations'); }
    setActionLoading(false)
  }

  // Closes modal explicitly resetting dynamic variables
  function dismissPriceModal() {
    setPriceItemName('')
    setPriceAmount('')
    setEditingPrice(null)
    setShowPriceModal(false)
  }

  return (
    <>
      <style>{`
        .finance-wrapper { padding: 40px; background: #f8fafc; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .header-section { margin-bottom: 24px; }
        .h1-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.01em; }
        .p-subtitle { color: #64748b; font-size: 14px; margin: 0; }

        /* Contained Pill Toggle Navigation (image_c07eaa.png) */
        .tab-bar-container {
          display: inline-flex;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 35px;
        }
        .tab-btn {
          padding: 8px 24px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          border-radius: 10px;
          transition: all 0.15s ease-in-out;
          border: none;
          background: transparent;
          text-transform: capitalize;
        }
        .tab-btn.active {
          background: #fff7ed;
          color: #f97316;
        }
        .tab-btn:hover:not(.active) {
          color: #0f172a;
          background: #f8fafc;
        }
        
        /* Metric Cards Matrix (image_c0e3a5.png Style) */
        .dashboard-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 35px; }
        .dashboard-card { 
          background: #ffffff; 
          border: 1px solid #e2e8f0; 
          border-radius: 16px; 
          padding: 24px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          transition: border-color 0.15s ease-in-out; 
          cursor: pointer; 
        }
        .dashboard-card:hover { border-color: #f97316; }
        .card-left { display: flex; flex-direction: column; gap: 4px; }
        .card-label { font-size: 13px; color: #64748b; font-weight: 500; }
        .card-value { font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin: 2px 0; }
        .card-subtext { font-size: 12px; color: #94a3b8; }
        .card-icon-container { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }

        /* Structural Content Blocks */
        .content-panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .panel-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
        
        /* Brand Action Buttons — Solid Brand Orange with Circle Plus Icon (image_b430e7.png Style) */
        .btn-brand-action { 
          background: #ff5500; 
          color: #ffffff; 
          border: none; 
          border-radius: 14px; 
          padding: 10px 24px; 
          font-size: 14px; 
          font-weight: 600; 
          cursor: pointer; 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
          transition: all 0.15s ease-in-out; 
          box-shadow: 0 2px 4px rgba(255, 85, 0, 0.15);
        }
        .btn-brand-action:hover:not(:disabled) { 
          background: #e64d00; 
          transform: translateY(-0.5px);
          box-shadow: 0 4px 8px rgba(255, 85, 0, 0.25);
        }
        .btn-brand-action:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-action-secondary { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s ease; }
        .btn-action-secondary:hover { background: #f8fafc; border-color: #94a3b8; }
        
        /* Dense Data Tables */
        .dense-table { width: 100%; border-collapse: collapse; text-align: left; }
        .dense-table th { font-size: 10px; color: #64748b; text-transform: uppercase; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 700; letter-spacing: 0.05em; background: #f8fafc; }
        .dense-table td { padding: 14px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
        .dense-table tr:hover td { background: #fbfcfd; }
        
        /* Controls & Form Inputs */
        .group-label { display: block; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
        .native-input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 18px; outline: none; font-size: 13px; transition: border-color 0.15s ease; background: #ffffff; color: #0f172a; }
        .native-input:focus { border-color: #0f172a; }
        
        /* Overlays & Drawers */
        .window-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.3); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .window-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; width: 100%; max-width: 460px; padding: 28px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); }
        .calculation-summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0; }
        .calculation-amount { color: #0f172a; font-size: 36px; font-weight: 800; letter-spacing: -0.03em; margin-top: 2px; }
      `}</style>

      <div className="finance-wrapper">
        <div className="header-section">
          <h1 className="h1-title">Finance Ledger</h1>
          <p className="p-subtitle">System billing, real-time invoice generation, and cost item configuration.</p>
        </div>
        
        <div className="tab-bar-container">
  {['overview', 'calculator', 'prices', 'payments'].map(t => (
    <button 
      key={t} 
      className={`tab-btn ${activeTab === t ? 'active' : ''}`} 
      onClick={() => setActiveTab(t)}
    >
      {t === 'calculator' ? 'fee calculator' : t}
    </button>
  ))}
</div>

        {activeTab === 'overview' && (
          <div>
            <div className="dashboard-grid">
              {[
                { label: 'Total Revenue', val: `$${payments.reduce((a, b) => a + Number(b.amount), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, desc: `${payments.length} completions`, icon: <Icons.DollarSign />, bg: '#fff7ed', color: '#ea580c', target: 'payments' },
                { label: 'Active Invoices', val: billings.filter(b => b.document_type === 'invoice').length.toString(), desc: 'Awaiting collections', icon: <Icons.FileText />, bg: '#eff6ff', color: '#2563eb', target: 'invoices' },
                { label: 'Pending Quotes', val: billings.filter(b => b.document_type === 'quotation').length.toString(), desc: 'Awaiting conversion', icon: <Icons.Layers />, bg: '#f5f3ff', color: '#7c3aed', target: 'quotations' },
                { label: 'Inventory Items', val: prices.length.toString(), desc: 'Rate structures', icon: <Icons.TrendingUp />, bg: '#f0fdf4', color: '#16a34a', target: 'prices' }
              ].map((s, i) => (
                <div key={i} className="dashboard-card" onClick={() => setActiveTab(s.target)}>
                  <div className="card-left">
                    <span className="card-label">{s.label}</span>
                    <span className="card-value">{s.val}</span>
                    <span className="card-subtext">{s.desc}</span>
                  </div>
                  <div className="card-icon-container" style={{ background: s.bg, color: s.color }}>
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            <div className="content-panel">
              <div className="panel-header">
                <h3 className="panel-title">Recent Transactions</h3>
              </div>
              <table className="dense-table">
                <thead><tr><th>Student / Learner</th><th>Allocation Details</th><th>Method</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>{payments.slice(0, 5).map(p => {
  const l = first(p.learner)
  return (
    <tr key={p.payment_id}>
      <td style={{ fontWeight: '600', color: '#0f172a' }}>
        {l ? `${l.first_name} ${l.surname}` : 'Unknown Student'}
      </td>
      <td>{p.transaction_ref || 'General'}</td>
      <td style={{ color: '#64748b', fontSize: '12px' }}>{p.payment_method}</td>
      <td style={{ fontWeight: '700', color: '#0f172a' }}>${Number(p.amount).toFixed(2)}</td>
      <td><StatusBadge status="paid" /></td>
    </tr>
  )
})}</tbody>
              </table>
            </div>
          </div>
        )}

       {activeTab === 'prices' && (
   <div className="content-panel">
      <div className="panel-header">
        <h3 className="panel-title">Prices Index</h3>
        <button className="btn-brand-action" onClick={() => { setEditingPrice(null); setShowPriceModal(true); }}>
          <Icons.PlusCircle /> New Price
        </button>
      </div>
      
      <table className="dense-table">
        <thead>
          <tr>
            <th>Configured Item Description</th>
            <th>Rate Pricing (USD)</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {prices.map(p => (
            <tr key={p.price_id}>
              <td style={{ fontWeight: '600' }}>{p.item_name}</td>
              <td style={{ fontWeight: '700' }}>${p.amount.toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>
                <button 
                  className="btn-action-secondary" 
                  style={{ padding: '4px 12px', fontSize: '12px' }} 
                  onClick={() => { 
                    setEditingPrice(p); 
                    setPriceItemName(p.item_name); 
                    setPriceAmount(p.amount.toString()); 
                    setShowPriceModal(true); 
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
   </div>
)}

{activeTab === 'calculator' && (
  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
    {/* Parameters Form */}
    <div className="content-panel">
      <h3 className="panel-title" style={{ marginBottom: '20px' }}>Input Pricing Details</h3>
      
      <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '20px' }}>
        <label className="group-label">System Member Profile</label>
        <select className="native-input" value={quoteLearner} onChange={e => { setQuoteLearner(e.target.value); setWalkInName(''); }} style={{ marginBottom: '12px' }}>
          <option value="">-- Associate Database Member --</option>
          {learners.map(l => <option key={l.user_id} value={l.user_id}>{l.first_name} {l.surname}</option>)}
        </select>
        
        <label className="group-label">Or Assign Non-Profile Account</label>
        <input className="native-input" value={walkInName} onChange={e => { setWalkInName(e.target.value); setQuoteLearner(''); }} placeholder="Manually input profile title" style={{ marginBottom: 0 }} />
      </div>

      <label className="group-label">Product / Service Definition</label>
      <select className="native-input" value={trainingType} onChange={e => setTrainingType(e.target.value)}>
        <option value="">Select target pricing structure...</option>
        {prices.map(p => <option key={p.price_id} value={p.item_name}>{p.item_name}</option>)}
      </select>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label className="group-label">Quantity (Lessons)</label>
          <input className="native-input" type="number" value={numLessons} onChange={e => setNumLessons(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeRegFee} onChange={e => setIncludeRegFee(e.target.checked)} style={{ width: '18px', height: '18px', margin: 0, accentColor: '#ff5500' }} />
            Apply Reg Fee
          </label>
        </div>
      </div>
    </div>

    {/* Live Calculations Panel */}
    {/* Live Calculations Panel */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div 
        className="content-panel" 
        style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '260px',
          background: '#fff7ed',               // Faint orange background
          border: '2px solid #f97316',         // High contrast orange lining
          boxShadow: '0 4px 12px rgba(249, 115, 22, 0.05)',
          borderRadius: '16px'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
          Calculated Total
        </span>
        
        <div className="calculation-amount" style={{ fontSize: '48px', color: '#000000', fontWeight: '900', fontFamily: 'monospace' }}>
          ${calculatedTotal.toFixed(2)}
        </div>

        <p style={{ fontSize: '13px', color: '#000000', fontWeight: '700', margin: '12px 0 24px 0', textAlign: 'center' }}>
          {numLessons || 0} Lessons 
          {includeRegFee ? ' + Registration Fee' : ''}
        </p>

      </div>
    </div>
      </div>
)}

        {activeTab === 'payments' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px' }}>
            <div className="content-panel">
              <h3 className="panel-title" style={{ marginBottom: '20px' }}>Process Inbound Ledger</h3>
              <label className="group-label">Assign Account Profile</label>
              <select className="native-input" value={payLearner} onChange={e => setPayLearner(e.target.value)}>
                <option value="">Select context user...</option>
                {learners.map(l => <option key={l.user_id} value={l.user_id}>{l.first_name} {l.surname}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label className="group-label">Amount ($)</label><input className="native-input" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
              <div>
  <label className="group-label">Allocation</label>
  <select className="native-input" value={payPurpose} onChange={e => setPayPurpose(e.target.value)}>
    <option value="">Select Purpose...</option>
    {prices.map(p => (
      <option key={p.price_id} value={p.item_name}>
        {p.item_name}
      </option>
    ))}
  </select>
</div>
              </div>
              <label className="group-label">Transaction Medium</label>
              <select className="native-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}><option>Cash</option><option>EcoCash</option><option>Bank Transfer</option></select>
              <button className="btn-brand-action" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={handleRecordPayment} disabled={actionLoading}>
                <Icons.PlusCircle /> Commit Entry
              </button>
            </div>
            
            <div className="content-panel">
              <h3 className="panel-title" style={{ marginBottom: '20px' }}>Historical Archive</h3>
              <table className="dense-table">
                <thead><tr><th>Timestamp</th><th>Learner Record</th><th>Allocation</th><th>Processed</th></tr></thead>
              <tbody>{payments.map(p => {
  const l = first(p.learner)
  return (
    <tr key={p.payment_id}>
      <td style={{ fontSize: '11px', color: '#64748b' }}>
        {new Date(p.payment_date).toLocaleDateString()}
      </td>
      <td style={{ fontWeight: '600', color: '#0f172a' }}>
        {l ? `${l.first_name} ${l.surname}` : 'Unknown Student'}
      </td>
      <td>{p.transaction_ref || 'General'}</td>
      <td style={{ fontWeight: '700', color: '#16a34a' }}>
        ${Number(p.amount).toFixed(2)}
      </td>
    </tr>
  )
})}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {showPriceModal && (
        <div className="window-overlay">
          <div className="window-box">
            <h2 className="panel-title" style={{ fontSize: '16px', marginBottom: '20px' }}>{editingPrice ? 'Modify Rate Configuration' : 'Append Rate Configuration'}</h2>
            <label className="group-label">Line Allocation Title</label>
            <input className="native-input" value={priceItemName} onChange={e => setPriceItemName(e.target.value)} placeholder="e.g. Class 2 Practical Unit" />
            <label className="group-label">Base Rate Fee (USD)</label>
            <input className="native-input" type="number" value={priceAmount} onChange={e => setPriceAmount(e.target.value)} placeholder="0.00" />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-action-secondary" onClick={dismissPriceModal}>Dismiss</button>
              {/* Correctly fires the integrated handler state now */}
              <button className="btn-brand-action" onClick={handleSavePrice} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Configurations'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuoteModal && (
        <div className="window-overlay">
          <div className="window-box">
            <h2 className="panel-title" style={{ fontSize: '16px', marginBottom: '25px' }}>Generate Inbound Statements</h2>
            <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '20px' }}>
              <label className="group-label">System Member Profile</label>
              <select className="native-input" value={quoteLearner} onChange={e => { setQuoteLearner(e.target.value); setWalkInName(''); }} style={{ marginBottom: '12px' }}>
                <option value="">-- Associate Database Member --</option>
                {learners.map(l => <option key={l.user_id} value={l.user_id}>{l.first_name} {l.surname}</option>)}
              </select>
              <label className="group-label">Or Assign Non-Profile Account</label>
              <input className="native-input" value={walkInName} onChange={e => { setWalkInName(e.target.value); setQuoteLearner(''); }} placeholder="Manually input profile title" style={{ marginBottom: 0 }} />
            </div>

            <label className="group-label">Product / Service Definition</label>
            <select className="native-input" value={trainingType} onChange={e => setTrainingType(e.target.value)}>
              <option value="">Select target pricing structure...</option>
              {prices.map(p => <option key={p.price_id} value={p.item_name}>{p.item_name}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label className="group-label">Quantity Scale</label><input className="native-input" type="number" value={numLessons} onChange={e => setNumLessons(e.target.value)} /></div>
              <div style={{ paddingTop: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeRegFee} onChange={e => setIncludeRegFee(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  Apply Reg Fee
                </label>
              </div>
            </div>

            <div className="calculation-summary-box">
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculated Net Line Sum</div>
              <div className="calculation-amount">${calculatedTotal.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-action-secondary" onClick={() => setShowQuoteModal(false)}>Cancel</button>
              <button className="btn-brand-action" onClick={() => handleSaveQuotation(true)} disabled={actionLoading}>Process Statement</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}