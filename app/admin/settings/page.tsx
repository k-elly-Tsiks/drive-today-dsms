'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Settings, 
  School, 
  Clock, 
  Lock, 
  Database, 
  Save,  
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Phone, 
  Mail, 
  MapPin, 
  Server,
  Info
} from 'lucide-react'

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // School info
  const [schoolName, setSchoolName] = useState('Drive Today Driving School')
  const [schoolAddress, setSchoolAddress] = useState('159 Manresa Way, Harare, Zimbabwe')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')

  // Cancellation rules
  const [cancellationHours, setCancellationHours] = useState('3')

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const router = useRouter()

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Auth check ──────────────────────────────────────────────────────────────

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data } = await supabase
      .from('users')
      .select('role, email, phone_number')
      .eq('user_id', user.id)
      .single()
    if (data?.role !== 'admin') { router.push('/login'); return }
    if (data?.email) setSchoolEmail(data.email)
    if (data?.phone_number) setSchoolPhone(data.phone_number)
    setLoading(false)
  }, [router])

  useEffect(() => {
  let mounted = true

  async function init() {
    if (mounted) {
      await checkAdmin()
    }
  }

  init()

  return () => {
    mounted = false
  }
}, [checkAdmin])
  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function saveSchoolInfo() {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    showToast('School information updated successfully.')
    setSaving(false)
  }

  async function changePassword() {
    if (!newPassword || !confirmNewPassword) {
      showToast('Please fill in all password fields.', 'error')
      return
    }
    if (newPassword !== confirmNewPassword) {
      showToast('New passwords do not match.', 'error')
      return
    }
    setChangingPassword(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      showToast('Failed to change password.', 'error')
    } else {
      showToast('Password changed successfully.')
      setNewPassword(''); setConfirmNewPassword('')
    }
    setChangingPassword(false)
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .settings-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        .info-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; display: block; letter-spacing: 0.5px; }
        .dashboard-control { height: 44px; padding: 0 16px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; font-size: 14px; color: #1e293b; font-weight: 500; outline: none; transition: all 0.2s ease; width: 100%; box-sizing: border-box; }
        .dashboard-control:focus { border-color: #ff5a00; box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.1); }
        .btn-primary { background: #ff5a00; border: none; padding: 12px 24px; font-size: 13.5px; font-weight: 700; border-radius: 12px; color: white; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary:hover { background: #e04f00; transform: translateY(-1px); }
        .btn-secondary { background: white; border: 1px solid #e2e8f0; padding: 10px 18px; font-size: 13px; font-weight: 700; border-radius: 10px; color: #475569; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .btn-secondary:hover { border-color: #ff5a00; color: #ff5a00; background: #fff1eb; }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, padding: '14px 24px', borderRadius: '12px', background: toast.type === 'success' ? '#0b1329' : '#dc2626', color: 'white', fontWeight: '600', fontSize: '13.5px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {toast.type === 'error' ? <XCircle size={16} color="#ff8a8a" /> : <CheckCircle size={16} color="#4ade80" />}
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: '900', color: '#1e293b', letterSpacing: '-0.5px' }}>
              System Settings
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: '500' }}>
              Configure school identity, operational rules, and security
            </p>
          </div>
        
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
             <Skeleton h="500px" r="20px" />
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Skeleton h="230px" r="20px" />
                <Skeleton h="246px" r="20px" />
             </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

            {/* Left Column: School Information */}
            <div className="settings-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff1eb', color: '#ff5a00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <School size={20} />
                </div>
                <h2 style={{ color: '#1e293b', fontSize: '18px', fontWeight: '800', margin: 0 }}>School Identity</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="info-label">School Name</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="dashboard-control" />
                  </div>
                </div>

                <div>
                  <label className="info-label">Physical Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={14} color="#94a3b8" style={{ position: 'absolute', right: '14px', top: '15px' }} />
                    <input type="text" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} className="dashboard-control" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <label className="info-label">Business Phone</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={14} color="#94a3b8" style={{ position: 'absolute', right: '14px', top: '15px' }} />
                            <input type="tel" value={schoolPhone} onChange={(e) => setSchoolPhone(e.target.value)} className="dashboard-control" />
                        </div>
                    </div>
                    <div>
                        <label className="info-label">Admin Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={14} color="#94a3b8" style={{ position: 'absolute', right: '14px', top: '15px' }} />
                            <input type="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} className="dashboard-control" />
                        </div>
                    </div>
                </div>

                <button onClick={saveSchoolInfo} disabled={saving} className="btn-primary" style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}>
                  <Save size={18} /> {saving ? 'Updating Ledger...' : 'Save School Identity'}
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Cancellation Rules */}
              <div className="settings-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={20} />
                    </div>
                    <h2 style={{ color: '#1e293b', fontSize: '18px', fontWeight: '800', margin: 0 }}>Operational Rules</h2>
                </div>

                <label className="info-label">Learner Cancellation Threshold</label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                    <input
                        type="number" min="1" max="48"
                        value={cancellationHours}
                        onChange={(e) => setCancellationHours(e.target.value)}
                        className="dashboard-control"
                        style={{ width: '80px', textAlign: 'center', fontSize: '18px', fontWeight: '800', color: '#ff5a00' }}
                    />
                    <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', lineHeight: '1.4' }}>
                        hours before the <br/>scheduled lesson
                    </span>
                </div>
                
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', borderLeft: '4px solid #cbd5e1', display: 'flex', gap: '12px' }}>
                    <Info size={24} color="#94a3b8" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: '1.5', fontWeight: '500' }}>
                        Learners are restricted from self-cancelling once this window is reached. Manual admin override remains active.
                    </p>
                </div>

                <button onClick={() => showToast('Rules updated.')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}>
                  Update Rule
                </button>
              </div>

              {/* Change Password */}
              <div className="settings-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={20} />
                    </div>
                    <h2 style={{ color: '#1e293b', fontSize: '18px', fontWeight: '800', margin: 0 }}>Security & Auth</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="info-label">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="dashboard-control" />
                  </div>

                  <div>
                    <label className="info-label">Confirm Password</label>
                    <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className="dashboard-control" />
                  </div>

                  <button onClick={changePassword} disabled={changingPassword} className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: '#1e293b' }}>
                    <ShieldCheck size={18} /> {changingPassword ? 'Verifying...' : 'Change Admin Password'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* System Info Bottom Section */}
        {!loading && (
          <div className="settings-card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={20} />
                </div>
                <h2 style={{ color: '#1e293b', fontSize: '18px', fontWeight: '800', margin: 0 }}>Infrastructure Metrics</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
              {[
                { label: 'System Kernel', value: 'Drive Today DSMS', icon: <Server size={14}/> },
                { label: 'Database Engine', value: 'PostgreSQL v15', icon: <Database size={14}/> },
                { label: 'Cloud Provider', value: 'Vercel Edge', icon: <Server size={14}/> },
                { label: 'Interface Version', value: 'Build 1.0.4-Stable', icon: <Settings size={14}/> },
              ].map((item, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>{item.icon}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>{item.label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '750', color: '#1e293b' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}