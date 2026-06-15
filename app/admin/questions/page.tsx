'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PlusCircle, Search, Book, Save, XCircle, CheckCircle,
  ArrowRight, ChevronLeft, Folder, Hash, Settings2, MoreVertical, Trash2, Edit2
} from 'lucide-react'

// ── TYPES ────────────────────────────────────────────────────────────────────

interface PracticeQuestion {
  question_id?: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false'
  category: string 
  option_a?: string | null
  option_b?: string | null
  option_c?: string | null
  option_d?: string | null
  correct_answer: string
  explanation?: string | null
  created_by?: string
}

interface ToastState {
  msg: string
  type: 'success' | 'error'
}

// ── COMPONENTS ───────────────────────────────────────────────────────────────

const Skeleton: React.FC<{ w?: string; h?: string; r?: string }> = ({ w = '100%', h = '20px', r = '8px' }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  }} />
)

const supabase = createClient()

export default function QuestionsDashboard() {
  
  // View State
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [showInitPopup, setShowInitPopup] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  
  // Data State
  const [batches, setBatches] = useState<string[]>([]) 
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  
  // Editor State
  const [originalFolderName, setOriginalFolderName] = useState('')
  const [folderName, setFolderName] = useState('')
  const [questionCount, setQuestionCount] = useState(1)
  const [batchQuestions, setBatchQuestions] = useState<PracticeQuestion[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  // ── DATA FETCHING ──────────────────────────────────────────────────────────

  const loadFolders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('practice_questions').select('category')
    if (data) {
      const unique = Array.from(new Set(data.map((q: { category: string }) => q.category)))
      setBatches(unique as string[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      await loadFolders()
    }
    init()

    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [loadFolders])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  // ── FOLDER ACTIONS ─────────────────────────────────────────────────────────

  const openEditor = async (name: string) => {
    setLoading(true)
    setView('editor')
    const { data } = await supabase.from('practice_questions').select('*').eq('category', name)
    if (data) {
      setOriginalFolderName(name)
      setFolderName(name)
      setBatchQuestions(data as PracticeQuestion[])
    }
    setLoading(false)
  }

  const deleteFolder = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the entire folder "${name}"?`)) return
    const { error } = await supabase.from('practice_questions').delete().eq('category', name)
    if (error) showToast("Failed to delete folder", "error")
    else {
      showToast("Folder deleted successfully")
      loadFolders()
    }
    setActiveMenu(null)
  }

  const saveBatch = async () => {
    if (!folderName.trim()) return showToast("Folder name is required", "error")
    setIsSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Clean up old category name if edited
    if (originalFolderName) {
      await supabase.from('practice_questions').delete().eq('category', originalFolderName)
    }

    const payload = batchQuestions.map(q => ({ ...q, category: folderName, created_by: user?.id }))
    const { error } = await supabase.from('practice_questions').insert(payload)

    if (error) showToast("Save failed", "error")
    else {
      showToast("Curriculum batch saved")
      setView('list')
      loadFolders()
    }
    setIsSaving(false)
  }

  const filtered = batches.filter(b => b.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .dashboard-container { padding: 40px; background: #f8fafc; min-height: 100%; }
        .editor-container { background: white; min-height: 100%; animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .input-base { height: 48px; padding: 0 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-size: 15px; color: #1e293b; outline: none; transition: 0.2s; width: 100%; }
        .input-base:focus { border-color: #ff5a00; box-shadow: 0 0 0 4px rgba(255, 90, 0, 0.1); }
        
        .btn-primary { background: #ff5a00; border: none; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 14px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-secondary { background: white; border: 1px solid #e2e8f0; padding: 12px 20px; font-size: 14px; font-weight: 700; border-radius: 12px; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        
        .f-card { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: 0.2s; position: relative; }
        .f-card:hover { border-color: #ff5a00; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.04); }
        
        .action-menu { position: absolute; right: 20px; top: 60px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 10; width: 160px; overflow: hidden; }
        .menu-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px; border: none; background: none; font-size: 13px; font-weight: 600; cursor: pointer; color: #475569; }
        .menu-btn:hover { background: #fff1eb; color: #ff5a00; }
        
        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(6px); }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999, padding: '16px 24px', borderRadius: '14px', background: '#0b1329', color: 'white', fontWeight: '700', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {toast.type === 'error' ? <XCircle size={18} color="#ff8a8a" /> : <CheckCircle size={18} color="#4ade80" />} {toast.msg}
        </div>
      )}

      {view === 'list' ? (
        /* ── FOLDER LIST VIEW ── */
        <div className="dashboard-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '30px', fontWeight: '900', color: '#1e293b' }}>Theory Folders</h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontWeight: '500' }}>Manage curriculum batches and question sets</p>
            </div>
            <button onClick={() => setShowInitPopup(true)} className="btn-primary">
              <PlusCircle size={20} /> Create New Folder
            </button>
          </div>

          <div style={{ position: 'relative', marginBottom: '32px' }}>
            <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              placeholder="Search folders..." value={search} onChange={e => setSearch(e.target.value)}
              className="input-base" style={{ paddingLeft: '50px', height: '56px', borderRadius: '16px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {loading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} h="100px" r="20px" />) : 
             filtered.map(name => (
               <div key={name} className="f-card" onClick={() => openEditor(name)}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '48px', height: '48px', background: '#fff1eb', color: '#ff5a00', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Folder size={24} fill="#ff5a00" />
                   </div>
                   <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>{name}</h3>
                 </div>
                 <button 
                   onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === name ? null : name); }}
                   style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                 >
                   <MoreVertical size={20} />
                 </button>

                 {activeMenu === name && (
                   <div className="action-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
                     <button className="menu-btn" onClick={() => openEditor(name)}><Edit2 size={14}/> Open & Edit</button>
                     <button className="menu-btn" style={{ color: '#dc2626' }} onClick={() => deleteFolder(name)}><Trash2 size={14}/> Delete Folder</button>
                   </div>
                 )}
               </div>
             ))
            }
          </div>
        </div>
      ) : (
        /* ── BATCH EDITOR VIEW (NO LONGER FIXED OVER DASHBOARD) ── */
        <div className="editor-container">
          <div style={{ padding: '24px 40px', borderBottom: '2px solid #ff5a00', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', position: 'sticky', top: 0, zIndex: 50 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
              <button onClick={() => { setView('list'); loadFolders(); }} className="btn-secondary" style={{ padding: '10px' }}><ChevronLeft size={20}/></button>
              <div style={{ flex: 1 }}>
                <input 
                  value={folderName} onChange={e => setFolderName(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '24px', fontWeight: '900', color: '#1e293b', outline: 'none', width: '100%', padding: 0 }}
                  placeholder="Folder Name..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px', fontWeight: '800' }}>
                  <Hash size={12} /> {batchQuestions.length} QUESTIONS IN BATCH
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setView('list')} className="btn-secondary">Cancel</button>
              <button onClick={saveBatch} disabled={isSaving} className="btn-primary">
                <Save size={18}/> {isSaving ? 'Saving...' : 'Save Folder'}
              </button>
            </div>
          </div>

          <div style={{ padding: '40px' }}>
            {loading ? <Skeleton h="400px" /> : batchQuestions.map((q, idx) => (
              <div key={idx} style={{ padding: '50px 0', borderBottom: '1px dashed #e2e8f0', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-40px', top: '50px', fontSize: '40px', fontWeight: '900', color: '#f1f5f9' }}>{idx + 1}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px 300px', gap: '24px', marginBottom: '24px' }}>
                   <div>
                     <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>QUESTION TEXT</label>
                     <textarea className="input-base" style={{ height: '100px', paddingTop: '12px', resize: 'none' }} value={q.question_text} onChange={e => {
                       const up = [...batchQuestions]; up[idx].question_text = e.target.value; setBatchQuestions(up);
                     }} />
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>TYPE</label>
                        <select className="input-base" value={q.question_type} onChange={e => {
                          const selectedType = e.target.value as PracticeQuestion['question_type']
                          const up = [...batchQuestions]; up[idx].question_type = selectedType; setBatchQuestions(up);
                        }}>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>CORRECT ANSWER</label>
                        <select className="input-base" style={{ color: '#ff5a00', fontWeight: '800' }} value={q.correct_answer} onChange={e => {
                          const up = [...batchQuestions]; up[idx].correct_answer = e.target.value; setBatchQuestions(up);
                        }}>
                          <option value="">Select Answer</option>
                          {q.question_type === 'multiple_choice' ? 
                            <><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></> :
                            <><option value="True">True</option><option value="False">False</option></>
                          }
                        </select>
                      </div>
                   </div>
                   <div style={{ background: '#f8fafc', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                      <Settings2 size={24} color="#cbd5e1" />
                   </div>
                </div>

                {q.question_type === 'multiple_choice' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', background: '#f8fafc', padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
                    {(['a', 'b', 'c', 'd'] as const).map(opt => {
                      const key = (`option_${opt}`) as 'option_a' | 'option_b' | 'option_c' | 'option_d'
                      return (
                        <div key={opt}>
                          <label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8' }}>OPTION {opt.toUpperCase()}</label>
                          <input className="input-base" value={(q as PracticeQuestion)[key] || ''} onChange={e => {
                            const up = [...batchQuestions]; (up[idx] as PracticeQuestion)[key] = e.target.value; setBatchQuestions(up);
                          }} />
                        </div>
                      )
                    })}
                  </div>
                )}
                <input className="input-base" placeholder="Learning explanation..." value={q.explanation || ''} onChange={e => {
                  const up = [...batchQuestions]; up[idx].explanation = e.target.value; setBatchQuestions(up);
                }} />
              </div>
            ))}
            <button onClick={saveBatch} className="btn-primary" style={{ margin: '60px auto 0', padding: '18px 60px', fontSize: '16px' }}>Save Entire Batch</button>
          </div>
        </div>
      )}

      {/* ── INIT POPUP ── */}
      {showInitPopup && (
        <div className="overlay">
          <div style={{ background: 'white', padding: '40px', borderRadius: '24px', width: '400px', textAlign: 'center' }}>
            <Book size={40} color="#ff5a00" style={{ marginBottom: '20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>Create Batch</h2>
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>FOLDER NAME</label>
              <input placeholder="e.g. Mock Exam 1" value={folderName} onChange={e => setFolderName(e.target.value)} className="input-base" />
            </div>
            <div style={{ textAlign: 'left', marginBottom: '30px' }}>
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>BATCH SIZE</label>
              <input type="number" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} className="input-base" style={{ textAlign: 'center', fontSize: '20px', fontWeight: '900' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowInitPopup(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={() => {
                setBatchQuestions(Array.from({ length: questionCount }).map(() => ({ question_text: '', question_type: 'multiple_choice', category: folderName, correct_answer: '' })));
                setShowInitPopup(false); setView('editor');
              }} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Initialize Batch <ArrowRight size={18}/></button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}