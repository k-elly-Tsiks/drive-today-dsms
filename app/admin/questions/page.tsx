'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface PracticeQuestion {
  question_id: string
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
  created_at?: string
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

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<PracticeQuestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  
  // Filters
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Form fields
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false'>('multiple_choice')
  const [category, setCategory] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionC, setOptionC] = useState('')
  const [optionD, setOptionD] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [explanation, setExplanation] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)

  // Design tokens
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const primary = '#3b82f6'
  const orange = '#f97316'
  const green = '#10b981'

  const categories = [
    { id: 'road_signs', label: 'Road Signs', icon: '🚦', color: '#ef4444' },
    { id: 'highway_code', label: 'Highway Code', icon: '📖', color: '#f59e0b' },
    { id: 'road_rules', label: 'Road Rules', icon: '🛣', color: '#3b82f6' },
    { id: 'safety', label: 'Safety', icon: '⛑', color: '#ec4899' },
    { id: 'parking', label: 'Parking', icon: '🅿', color: '#8b5cf6' },
    { id: 'other', label: 'Other', icon: '📝', color: '#64748b' },
  ]

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('practice_questions')
      .select('*')
      .order('created_at', { ascending: false })
    setQuestions(data || [])
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
    await loadQuestions()
  }, [loadQuestions])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await checkAdmin()
    }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingQuestion(null)
    setQuestionText('')
    setQuestionType('multiple_choice')
    setCategory('')
    setOptionA('')
    setOptionB('')
    setOptionC('')
    setOptionD('')
    setCorrectAnswer('')
    setExplanation('')
    setError('')
    setShowModal(true)
  }

  function openEditModal(question: PracticeQuestion) {
    setEditingQuestion(question)
    setQuestionText(question.question_text)
    setQuestionType(question.question_type)
    setCategory(question.category)
    setOptionA(question.option_a || '')
    setOptionB(question.option_b || '')
    setOptionC(question.option_c || '')
    setOptionD(question.option_d || '')
    setCorrectAnswer(question.correct_answer)
    setExplanation(question.explanation || '')
    setError('')
    setShowModal(true)
  }

  async function saveQuestion() {
    if (!questionText || !category || !correctAnswer) {
      setError('Please fill in all required fields.')
      return
    }

    if (questionType === 'multiple_choice') {
      if (!optionA || !optionB || !optionC || !optionD) {
        setError('Please fill in all four options for multiple choice questions.')
        return
      }
      if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
        setError('Correct answer must be A, B, C or D for multiple choice questions.')
        return
      }
    }

    if (questionType === 'true_false') {
      if (!['True', 'False'].includes(correctAnswer)) {
        setError('Correct answer must be True or False.')
        return
      }
    }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const questionData = {
      question_text: questionText,
      question_type: questionType,
      category,
      option_a: questionType === 'multiple_choice' ? optionA : null,
      option_b: questionType === 'multiple_choice' ? optionB : null,
      option_c: questionType === 'multiple_choice' ? optionC : null,
      option_d: questionType === 'multiple_choice' ? optionD : null,
      correct_answer: correctAnswer,
      explanation: explanation || null,
      created_by: user?.id,
    }

    if (editingQuestion) {
      const { error: updateError } = await supabase
        .from('practice_questions')
        .update(questionData)
        .eq('question_id', editingQuestion.question_id)

      if (updateError) {
        setError('Failed to update question.')
        setSaving(false)
        return
      }
      setSuccessMessage('Question updated successfully.')
    } else {
      const { error: insertError } = await supabase
        .from('practice_questions')
        .insert(questionData)

      if (insertError) {
        setError('Failed to save question.')
        setSaving(false)
        return
      }
      setSuccessMessage('Question added successfully.')
    }

    setTimeout(() => setSuccessMessage(''), 3000)
    setShowModal(false)
    setSaving(false)
    loadQuestions()
  }

  async function deleteQuestion(questionId: string) {
    const { error: deleteError } = await supabase
      .from('practice_questions')
      .delete()
      .eq('question_id', questionId)

    if (deleteError) {
      setError('Failed to delete question.')
      setTimeout(() => setError(''), 3000)
      return
    }

    setSuccessMessage('Question deleted successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadQuestions()
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question_text?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = filterCategory === 'all' || q.category === filterCategory
    const matchesType = filterType === 'all' || q.question_type === filterType
    return matchesSearch && matchesCategory && matchesType
  })

  function getCategoryIcon(cat: string) {
    return categories.find(c => c.id === cat)?.icon || '📝'
  }

  function getCategoryLabel(cat: string) {
    return categories.find(c => c.id === cat)?.label || cat
  }

  const handleStatClick = (type: string) => {
    if (type === 'all') {
      setFilterType('all')
      setFilterCategory('all')
    } else if (type === 'multiple_choice' || type === 'true_false') {
      setFilterType(type)
      setFilterCategory('all')
    }
    setSearch('')
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
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>❓ Practice Questions</h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>
              Add and manage multiple choice and true or false practice questions
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => router.push('/admin/dashboard')}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: 'white', color: textDark, fontSize: '13px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              ← Dashboard
            </button>
            <button 
              onClick={openAddModal} 
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none',
                background: primary, color: 'white', fontSize: '13px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              + Add Question
            </button>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
            ✅ {successMessage}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>
            ❌ {error}
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {loading ? (
             Array(3).fill(0).map((_, i) => (
               <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <Skeleton h="28px" w="40px" r="6px" />
                 <div style={{ marginTop: '8px' }}><Skeleton h="11px" w="70%" r="4px" /></div>
               </div>
             ))
          ) : (
            [
              { id: 'all', label: 'Total Questions', value: questions.length, color: textDark },
              { id: 'multiple_choice', label: 'Multiple Choice', value: questions.filter(q => q.question_type === 'multiple_choice').length, color: orange },
              { id: 'true_false', label: 'True / False', value: questions.filter(q => q.question_type === 'true_false').length, color: green },
            ].map((stat) => (
              <div 
                key={stat.id} 
                onClick={() => handleStatClick(stat.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
                style={{
                  background: 'white', borderRadius: '10px', padding: '20px 22px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${stat.color}`,
                  cursor: 'pointer', transition: 'transform 0.15s',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>{stat.value}</p>
                <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '500' }}>{stat.label}</p>
              </div>
            ))
          )}
        </div>

        {/* Search and Filters */}
        <div style={{
          background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {/* Top row: search + type filter */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="🔍 Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all', label: 'All Types' },
                { id: 'multiple_choice', label: 'Multiple Choice' },
                { id: 'true_false', label: 'True / False' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id)}
                  style={{
                    padding: '8px 14px', borderRadius: '20px',
                    border: filterType === t.id ? 'none' : '1px solid #e2e8f0',
                    background: filterType === t.id ? textDark : 'white',
                    color: filterType === t.id ? 'white' : textMuted,
                    fontSize: '12px', fontWeight: filterType === t.id ? '700' : '500',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Bottom row: category filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[{ id: 'all', label: 'All Categories', icon: '' }, ...categories].map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                style={{
                  padding: '8px 14px', borderRadius: '20px',
                  border: filterCategory === cat.id ? 'none' : '1px solid #e2e8f0',
                  background: filterCategory === cat.id ? textDark : 'white',
                  color: filterCategory === cat.id ? 'white' : textMuted,
                  fontSize: '12px', fontWeight: filterCategory === cat.id ? '700' : '500',
                  cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {cat.icon && <span>{cat.icon}</span>} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Questions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
             Array(4).fill(0).map((_, i) => (
               <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                   <Skeleton w="60px" h="20px" r="10px" />
                   <Skeleton w="100px" h="20px" r="10px" />
                   <Skeleton w="40px" h="20px" r="10px" />
                 </div>
                 <Skeleton w="90%" h="16px" r="4px" />
                 <div style={{ marginTop: '6px' }}><Skeleton w="60%" h="16px" r="4px" /></div>
               </div>
             ))
          ) : filteredQuestions.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '10px', padding: '60px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>❓</p>
              <p style={{ color: textDark, fontSize: '14px', fontWeight: '600', margin: '0 0 4px' }}>No questions found</p>
              <p style={{ color: textMuted, fontSize: '13px', margin: 0, fontWeight: '500' }}>Adjust filters or click Add Question to create one.</p>
            </div>
          ) : (
            filteredQuestions.map((question, index) => (
              <div 
                key={question.question_id} 
                style={{ 
                  background: 'white', borderRadius: '10px', padding: '24px', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                  borderLeft: `4px solid ${question.question_type === 'multiple_choice' ? orange : green}` 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    {/* Tags row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#f1f5f9', color: textMuted, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                        Q{index + 1}
                      </span>
                      <span style={{ background: question.question_type === 'multiple_choice' ? '#fff7ed' : '#f0fdf4', color: question.question_type === 'multiple_choice' ? orange : green, padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', border: `1px solid ${question.question_type === 'multiple_choice' ? '#ffedd5' : '#dcfce7'}` }}>
                        {question.question_type === 'multiple_choice' ? 'Multiple Choice' : 'True / False'}
                      </span>
                      <span style={{ background: '#f1f5f9', color: textDark, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                        {getCategoryIcon(question.category)} {getCategoryLabel(question.category)}
                      </span>
                    </div>
                    {/* Question text */}
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: textDark, lineHeight: '1.6' }}>
                      {question.question_text}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => openEditModal(question)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}>Edit</button>
                    <button onClick={() => deleteQuestion(question.question_id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}>Delete</button>
                  </div>
                </div>

                {/* Answer Options */}
                {question.question_type === 'multiple_choice' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    {[
                      { key: 'A', value: question.option_a },
                      { key: 'B', value: question.option_b },
                      { key: 'C', value: question.option_c },
                      { key: 'D', value: question.option_d },
                    ].map(opt => {
                      const isCorrect = question.correct_answer === opt.key
                      return (
                        <div key={opt.key} style={{ padding: '10px 14px', borderRadius: '8px', background: isCorrect ? '#f0fdf4' : '#f8fafc', border: isCorrect ? '1px solid #86efac' : '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: isCorrect ? green : '#e2e8f0', color: isCorrect ? 'white' : textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                            {opt.key}
                          </span>
                          <span style={{ fontSize: '13px', color: isCorrect ? '#065f46' : textDark, fontWeight: isCorrect ? '600' : '400' }}>{opt.value}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {question.question_type === 'true_false' && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    {['True', 'False'].map(opt => {
                      const isCorrect = question.correct_answer === opt
                      return (
                        <div key={opt} style={{ padding: '10px 20px', borderRadius: '8px', background: isCorrect ? '#f0fdf4' : '#f8fafc', border: isCorrect ? '1px solid #86efac' : '1px solid #f1f5f9', fontSize: '13px', fontWeight: isCorrect ? '700' : '500', color: isCorrect ? '#065f46' : textMuted }}>
                          {isCorrect ? '✓ ' : ''}{opt}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Explanation */}
                {question.explanation && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', borderLeft: '3px solid #cbd5e1' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: textMuted, lineHeight: '1.5' }}>
                      <strong style={{ color: textDark }}>Explanation:</strong> {question.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── ADD / EDIT MODAL ── */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '560px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>
                {editingQuestion ? 'Edit Question' : 'Add Question'}
              </h2>

              {error && (
                <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', color: '#dc2626', fontSize: '13px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Question Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Question Type *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'multiple_choice', label: 'Multiple Choice (4 Options)' },
                      { id: 'true_false', label: 'True / False' },
                    ].map(t => (
                      <button 
                        key={t.id} type="button" 
                        onClick={() => { setQuestionType(t.id as 'multiple_choice' | 'true_false'); setCorrectAnswer('') }} 
                        style={{ 
                          flex: 1, padding: '12px', borderRadius: '8px', border: questionType === t.id ? 'none' : '1px solid #e2e8f0', 
                          background: questionType === t.id ? textDark : 'white', color: questionType === t.id ? 'white' : textMuted, 
                          fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Category *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    {categories.map(cat => (
                      <button 
                        key={cat.id} type="button" 
                        onClick={() => setCategory(cat.id)} 
                        style={{ 
                          padding: '10px 12px', borderRadius: '8px', border: category === cat.id ? 'none' : '1px solid #e2e8f0', 
                          background: category === cat.id ? textDark : 'white', color: category === cat.id ? 'white' : textMuted, 
                          fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <span>{cat.icon}</span> <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Question Text *</label>
                  <textarea 
                    value={questionText} onChange={(e) => setQuestionText(e.target.value)} 
                    placeholder="Type your question here..." rows={3} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} 
                  />
                </div>

                {/* Answer Options */}
                {questionType === 'multiple_choice' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark }}>Answer Options *</label>
                      <span style={{ fontSize: '11px', color: textMuted }}>Click a letter to mark as correct</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { key: 'A', value: optionA, setter: setOptionA },
                        { key: 'B', value: optionB, setter: setOptionB },
                        { key: 'C', value: optionC, setter: setOptionC },
                        { key: 'D', value: optionD, setter: setOptionD },
                      ].map(opt => {
                        const isCorrect = correctAnswer === opt.key
                        return (
                          <div key={opt.key} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div 
                              style={{ 
                                width: '32px', height: '32px', borderRadius: '6px', 
                                background: isCorrect ? green : '#f1f5f9', color: isCorrect ? 'white' : textMuted, 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', 
                                flexShrink: 0, cursor: 'pointer', transition: 'background 0.2s',
                                border: isCorrect ? 'none' : '1px solid #e2e8f0'
                              }} 
                              onClick={() => setCorrectAnswer(opt.key)}
                            >
                              {opt.key}
                            </div>
                            <input 
                              type="text" value={opt.value} onChange={(e) => opt.setter(e.target.value)} 
                              placeholder={`Option ${opt.key}`} 
                              style={{ 
                                flex: 1, padding: '10px 14px', borderRadius: '8px', 
                                border: isCorrect ? '1.5px solid #86efac' : '1.5px solid #e2e8f0', 
                                background: isCorrect ? '#f0fdf4' : 'white', fontSize: '14px', outline: 'none' 
                              }} 
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {questionType === 'true_false' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Correct Answer *</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {['True', 'False'].map(opt => {
                        const isCorrect = correctAnswer === opt
                        return (
                          <button 
                            key={opt} type="button" onClick={() => setCorrectAnswer(opt)} 
                            style={{ 
                              flex: 1, padding: '12px', borderRadius: '8px', 
                              border: isCorrect ? 'none' : '1px solid #e2e8f0', 
                              background: isCorrect ? green : 'white', color: isCorrect ? 'white' : textMuted, 
                              fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>Explanation (optional)</label>
                  <textarea 
                    value={explanation} onChange={(e) => setExplanation(e.target.value)} 
                    placeholder="Explain why the answer is correct..." rows={2} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} 
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '32px' }}>
                <button 
                  onClick={() => { setShowModal(false); setError('') }} 
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveQuestion} disabled={saving} 
                  style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: saving ? '#cbd5e1' : primary, color: 'white', fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
