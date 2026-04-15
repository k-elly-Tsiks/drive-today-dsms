'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<PracticeQuestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Form fields
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState('multiple_choice')
  const [category, setCategory] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionC, setOptionC] = useState('')
  const [optionD, setOptionD] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [explanation, setExplanation] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const categories = [
    { id: 'road_signs', label: 'Road Signs', icon: '🚦' },
    { id: 'highway_code', label: 'Highway Code', icon: '📖' },
    { id: 'road_rules', label: 'Road Rules', icon: '🛣' },
    { id: 'safety', label: 'Safety', icon: '⛑' },
    { id: 'parking', label: 'Parking', icon: '🅿' },
    { id: 'other', label: 'Other', icon: '📝' },
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

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('practice_questions')
      .select('*')
      .order('created_at', { ascending: false })
    setQuestions(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
  const init = async () => {
    await checkAdmin()

    // Only load questions if user is admin
    await loadQuestions()
  }

  init()
}, [checkAdmin, loadQuestions])


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
      const { error } = await supabase
        .from('practice_questions')
        .update(questionData)
        .eq('question_id', editingQuestion.question_id)

      if (error) {
        setError('Failed to update question.')
        setSaving(false)
        return
      }

      setSuccessMessage('Question updated successfully.')
    } else {
      const { error } = await supabase
        .from('practice_questions')
        .insert(questionData)

      if (error) {
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
    const { error } = await supabase
      .from('practice_questions')
      .delete()
      .eq('question_id', questionId)

    if (error) {
      setError('Failed to delete question.')
      setTimeout(() => setError(''), 3000)
      return
    }

    setSuccessMessage('Question deleted.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadQuestions()
  }

  // Filter and search
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
        <p style={{ color: blue, fontWeight: '600' }}>Loading Questions...</p>
      </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>❓ Practice Questions</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Add and manage multiple choice and true or false practice questions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
        onClick={openAddModal} 
        style={{ padding: '10px 18px', borderRadius: '10px',
         border: 'none', 
         background: `linear-gradient(135deg, ${blue}, ${orange})`,
          color: 'white', fontSize: '13px', 
          fontWeight: '600', cursor: 'pointer' 
          }}>
          + Add Question
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Questions', value: questions.length, colour: blue },
          { label: 'Multiple Choice', value: questions.filter(q => q.question_type === 'multiple_choice').length, colour: orange },
          { label: 'True / False', value: questions.filter(q => q.question_type === 'true_false').length, colour: '#059669' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${stat.colour}` }}>
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }}
        />

        {/* Type filter */}
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
                padding: '8px 12px', borderRadius: '20px',
                border: filterType === t.id ? 'none' : '1px solid #e5e7eb',
                background: filterType === t.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white',
                color: filterType === t.id ? 'white' : '#6b7280',
                fontSize: '12px', fontWeight: filterType === t.id ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'All Categories' }, ...categories].map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              style={{
                padding: '8px 12px', borderRadius: '20px',
                border: filterCategory === cat.id ? 'none' : '1px solid #e5e7eb',
                background: filterCategory === cat.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white',
                color: filterCategory === cat.id ? 'white' : '#6b7280',
                fontSize: '12px', fontWeight: filterCategory === cat.id ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {'label' in cat ? cat.label : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredQuestions.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>❓</p>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 4px' }}>No questions found</p>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Click Add Question to create your first practice question</p>
          </div>
        ) : (
          filteredQuestions.map((question, index) => (
            <div key={question.question_id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${question.question_type === 'multiple_choice' ? orange : '#059669'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ background: question.question_type === 'multiple_choice' ? '#fff7ed' : '#f0fdf4', color: question.question_type === 'multiple_choice' ? orange : '#059669', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>
                      {question.question_type === 'multiple_choice' ? 'Multiple Choice' : 'True / False'}
                    </span>
                    <span style={{ background: lightBlue, color: blue, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>
                      {getCategoryIcon(question.category)} {getCategoryLabel(question.category)}
                    </span>
                    <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>
                      Q{index + 1}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111827', lineHeight: '1.5' }}>
                    {question.question_text}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => openEditModal(question)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: lightBlue, color: blue, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deleteQuestion(question.question_id)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>

              {question.question_type === 'multiple_choice' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  {[
                    { key: 'A', value: question.option_a },
                    { key: 'B', value: question.option_b },
                    { key: 'C', value: question.option_c },
                    { key: 'D', value: question.option_d },
                  ].map(opt => (
                    <div key={opt.key} style={{ padding: '8px 12px', borderRadius: '8px', background: question.correct_answer === opt.key ? '#d1fae5' : '#f9fafb', border: question.correct_answer === opt.key ? '1px solid #6ee7b7' : '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: question.correct_answer === opt.key ? '#059669' : '#e5e7eb', color: question.correct_answer === opt.key ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                        {opt.key}
                      </span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>{opt.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {question.question_type === 'true_false' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  {['True', 'False'].map(opt => (
                    <div key={opt} style={{ padding: '8px 16px', borderRadius: '8px', background: question.correct_answer === opt ? '#d1fae5' : '#f9fafb', border: question.correct_answer === opt ? '1px solid #6ee7b7' : '1px solid #f3f4f6', fontSize: '13px', fontWeight: '600', color: question.correct_answer === opt ? '#059669' : '#6b7280' }}>
                      {question.correct_answer === opt ? '✓ ' : ''}{opt}
                    </div>
                  ))}
                </div>
              )}

              {question.explanation && (
                <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 14px', border: '1px solid #fde68a' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>💡 <strong>Explanation:</strong> {question.explanation}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '540px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>
              {editingQuestion ? 'Edit Question' : 'Add Question'}
            </h2>

            {error && (
              <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Question Type *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'multiple_choice', label: '4 Options', icon: '🔘' },
                    { id: 'true_false', label: 'True / False', icon: '✅' },
                  ].map(t => (
                    <button key={t.id} type="button" onClick={() => { setQuestionType(t.id); setCorrectAnswer('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: questionType === t.id ? 'none' : '1px solid #e5e7eb', background: questionType === t.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: questionType === t.id ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Category *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} style={{ padding: '8px', borderRadius: '10px', border: category === cat.id ? 'none' : '1px solid #e5e7eb', background: category === cat.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: category === cat.id ? 'white' : '#6b7280', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Question Text *</label>
                <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Type your question here..." rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              </div>

              {questionType === 'multiple_choice' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Answer Options *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'A', value: optionA, setter: setOptionA },
                      { key: 'B', value: optionB, setter: setOptionB },
                      { key: 'C', value: optionC, setter: setOptionC },
                      { key: 'D', value: optionD, setter: setOptionD },
                    ].map(opt => (
                      <div key={opt.key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: correctAnswer === opt.key ? '#059669' : '#e5e7eb', color: correctAnswer === opt.key ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0, cursor: 'pointer' }} onClick={() => setCorrectAnswer(opt.key)}>
                          {opt.key}
                        </div>
                        <input type="text" value={opt.value} onChange={(e) => opt.setter(e.target.value)} placeholder={`Option ${opt.key}`} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: correctAnswer === opt.key ? '1px solid #6ee7b7' : '1px solid #e5e7eb', background: correctAnswer === opt.key ? '#f0fdf4' : 'white', fontSize: '13px', outline: 'none' }} />
                      </div>
                    ))}
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>💡 Click the letter circle to mark the correct answer</p>
                  </div>
                </div>
              )}

              {questionType === 'true_false' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Correct Answer *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['True', 'False'].map(opt => (
                      <button key={opt} type="button" onClick={() => setCorrectAnswer(opt)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: correctAnswer === opt ? 'none' : '1px solid #e5e7eb', background: correctAnswer === opt ? '#059669' : 'white', color: correctAnswer === opt ? 'white' : '#6b7280', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Explanation (optional)</label>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explain why the answer is correct..." rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => { setShowModal(false); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveQuestion} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: saving ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: saving ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
