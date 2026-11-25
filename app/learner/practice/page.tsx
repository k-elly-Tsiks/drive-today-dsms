'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { BookOpen, CheckCircle, CircleHelp, FileQuestion, ListChecks, ParkingCircle, Rocket, ShieldCheck, ThumbsUp, TrafficCone, XCircle } from 'lucide-react'

type Question = {
  question_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false'
  category: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct_answer: string
  explanation?: string
  created_at: string
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

export default function LearnerPracticePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('start')
  const [filterCategory, setFilterCategory] = useState('all')
  const [testQuestions, setTestQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)

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


  const categories = [
    { id: 'all',              label: 'All Categories', icon: <ListChecks size={18} /> },
    { id: 'road_signs',       label: 'Road Signs',     icon: <TrafficCone size={18} /> },
    { id: 'highway_code',     label: 'Highway Code',   icon: <BookOpen size={18} /> },
    { id: 'road_rules',       label: 'Road Rules',     icon: <FileQuestion size={18} /> },
    { id: 'safety',           label: 'Safety',         icon: <ShieldCheck size={18} /> },
    { id: 'parking',          label: 'Parking',        icon: <ParkingCircle size={18} /> },
    { id: 'other',            label: 'Other',          icon: <CircleHelp size={18} /> },
  ]

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data } = await supabase
      .from('practice_questions')
      .select('*')
      .order('created_at', { ascending: false })

    setQuestions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadQuestions()
    }
    init()
    return () => { cancelled = true }
  }, [loadQuestions])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function startTest() {
    const pool = filterCategory === 'all'
      ? questions
      : questions.filter(q => q.category === filterCategory)

    if (pool.length === 0) return

    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(10, shuffled.length))

    setTestQuestions(selected)
    setAnswers({})
    setSubmitted(false)
    setScore(0)
    setCurrentQuestion(0)
    setActiveTab('test')
  }

  function selectAnswer(questionId: string, answer: string) {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  function submitTest() {
    let correct = 0
    testQuestions.forEach(q => {
      if (answers[q.question_id] === q.correct_answer) correct++
    })
    setScore(correct)
    setSubmitted(true)
    setActiveTab('results')
  }

  function resetTest() {
    setTestQuestions([])
    setAnswers({})
    setSubmitted(false)
    setScore(0)
    setCurrentQuestion(0)
    setActiveTab('start')
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function getScoreColour(s: number, total: number) {
    const pct = (s / total) * 100
    if (pct >= 80) return '#059669'
    if (pct >= 60) return orange
    return '#dc2626'
  }

  function getScoreMessage(s: number, total: number) {
    const pct = (s / total) * 100
    if (pct >= 80) return 'Excellent! You are well prepared.'
    if (pct >= 60) return 'Good effort! Keep practising.'
    if (pct >= 40) return 'Keep studying. You can do better.'
    return 'Do not give up! Review your materials and try again.'
  }

  function getOptionText(q: Question, key: string): string {
    const map: Record<string, string | undefined> = {
      A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d,
    }
    return map[key] ?? ''
  }

  const answeredCount = Object.keys(answers).length
  const totalQuestions = testQuestions.length

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── START TAB ── */}
      {activeTab === 'start' && (
        <div>

          {/* Header with dashboard button */}
          <div className="learner-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>Practice Tests</h1>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Test your knowledge before your driving test</p>
            </div>
           
          </div>

          <div style={{ background: blue, borderRadius: '16px', padding: '28px', marginBottom: '24px', textAlign: 'center' }}>
            <CircleHelp size={48} color="#ffffff" style={{ marginBottom: '12px' }} />
            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 8px' }}>Ready to practise?</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: 0 }}>
              Test your knowledge with up to 10 questions. All questions are automatically marked upon submission.
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Skeleton w="24px" h="24px" r="50%" />
                  <Skeleton w="40px" h="20px" r="4px" />
                  <Skeleton w="60px" h="10px" r="4px" />
                </div>
              ))
            ) : (
              [
                { label: 'Total Questions', value: questions.length,                                                    icon: <ListChecks size={18} color="#2563eb" />, colour: '#2563eb', badgeBg: '#eff6ff' },
                { label: 'Multiple Choice', value: questions.filter(q => q.question_type === 'multiple_choice').length, icon: <CircleHelp size={18} color={orange} />, colour: orange, badgeBg: '#fff2eb' },
                { label: 'True / False',    value: questions.filter(q => q.question_type === 'true_false').length,      icon: <CheckCircle size={18} color="#059669" />, colour: '#059669', badgeBg: '#f0fdf4' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '16px', textAlign: 'center', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: stat.badgeBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>{stat.icon}</div>
                  <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{stat.label}</p>
                </div>
              ))
            )}
          </div>

          {loading ? (
            <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Skeleton w="120px" h="14px" r="4px" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', marginTop: '12px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} w="100%" h="42px" r="10px" />
                ))}
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <ListChecks size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No practice questions available yet. Please check back later.</p>
            </div>
          ) : (
            <>
              {/* Category selector */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: blue }}>Select Category</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                  {categories.map(cat => {
                    const count = cat.id === 'all' ? questions.length : questions.filter(q => q.category === cat.id).length
                    if (count === 0 && cat.id !== 'all') return null
                    const isActive = filterCategory === cat.id
                    return (
                      <button key={cat.id} onClick={() => setFilterCategory(cat.id)}
                        style={{ padding: '12px', borderRadius: '10px', border: isActive ? 'none' : '1px solid #e5e7eb', background: isActive ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', color: isActive ? 'white' : '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex' }}>{cat.icon}</span>
                        <span>{cat.label}</span>
                        <span style={{ marginLeft: 'auto', background: isActive ? 'rgba(255,255,255,0.2)' : lightBlue, color: isActive ? 'white' : blue, padding: '1px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={startTest} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: orange, color: 'white', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 20px rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Rocket size={18} /> Start Practice Test
              </button>
            </>
          )}
        </div>
      )}

      {/* ── TEST TAB ── */}
      {activeTab === 'test' && testQuestions.length > 0 && (
        <div>

          {/* Progress bar */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: blue }}>{answeredCount} of {totalQuestions} answered</span>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Q{currentQuestion + 1} of {totalQuestions}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(answeredCount / totalQuestions) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${blue}, ${orange})`, borderRadius: '4px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Question nav dots */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {testQuestions.map((q, i) => {
              const isAnswered = !!answers[q.question_id]
              const isCurrent = currentQuestion === i
              return (
                <button key={q.question_id} onClick={() => setCurrentQuestion(i)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: isCurrent ? `2px solid ${blue}` : 'none', background: isAnswered ? `linear-gradient(135deg, ${blue}, ${orange})` : isCurrent ? lightBlue : '#f3f4f6', color: isAnswered ? 'white' : isCurrent ? blue : '#9ca3af', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  {i + 1}
                </button>
              )
            })}
          </div>

          {/* Current question */}
          {(() => {
            const q = testQuestions[currentQuestion]
            return (
              <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: orange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>
                    {currentQuestion + 1}
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827', lineHeight: '1.5', flex: 1 }}>{q.question_text}</p>
                </div>

                {/* Multiple choice */}
                {q.question_type === 'multiple_choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(['A', 'B', 'C', 'D'] as const).map(key => {
                      const val = getOptionText(q, key)
                      if (!val) return null
                      const isSelected = answers[q.question_id] === key
                      return (
                        <button key={key} onClick={() => selectAnswer(q.question_id, key)}
                          style={{ padding: '14px 16px', borderRadius: '10px', border: isSelected ? `2px solid ${blue}` : '1px solid #e5e7eb', background: isSelected ? lightBlue : 'white', color: '#374151', fontSize: '14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s ease' }}>
                          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: isSelected ? `linear-gradient(135deg, ${blue}, ${orange})` : '#f3f4f6', color: isSelected ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{key}</span>
                          <span style={{ fontWeight: isSelected ? '600' : '400' }}>{val}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* True / False */}
                {q.question_type === 'true_false' && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['True', 'False'].map(opt => {
                      const isSelected = answers[q.question_id] === opt
                      const borderColour = opt === 'True' ? '#059669' : '#dc2626'
                      return (
                        <button key={opt} onClick={() => selectAnswer(q.question_id, opt)}
                          style={{ flex: 1, padding: '16px', borderRadius: '10px', border: isSelected ? `2px solid ${borderColour}` : '1px solid #e5e7eb', background: isSelected ? (opt === 'True' ? '#f0fdf4' : '#fff1f2') : 'white', color: isSelected ? borderColour : '#6b7280', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
                          <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: '6px' }}>{opt === 'True' ? <CheckCircle size={18} /> : <XCircle size={18} />}</span>{opt}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))} disabled={currentQuestion === 0}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: currentQuestion === 0 ? '#f9fafb' : 'white', color: currentQuestion === 0 ? '#9ca3af' : '#374151', fontSize: '14px', fontWeight: '600', cursor: currentQuestion === 0 ? 'not-allowed' : 'pointer' }}>
              Previous
            </button>
            {currentQuestion < totalQuestions - 1 ? (
              <button onClick={() => setCurrentQuestion(prev => Math.min(totalQuestions - 1, prev + 1))}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Next
              </button>
            ) : (
              <button onClick={submitTest} disabled={answeredCount < totalQuestions}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: answeredCount < totalQuestions ? '#e5e7eb' : '#059669', color: answeredCount < totalQuestions ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: answeredCount < totalQuestions ? 'not-allowed' : 'pointer' }}>
                {answeredCount < totalQuestions ? `Answer ${totalQuestions - answeredCount} more to submit` : 'Submit Test'}
              </button>
            )}
          </div>

          <button onClick={resetTest} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>
            Quit Test
          </button>
        </div>
      )}

      {/* ── RESULTS TAB ── */}
      {activeTab === 'results' && (
        <div>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginBottom: '24px', border: `3px solid ${getScoreColour(score, totalQuestions)}` }}>
            <p style={{ fontSize: '56px', margin: '0 0 8px' }}>
              {score / totalQuestions >= 0.8 ? <CheckCircle size={56} color="#059669" /> : score / totalQuestions >= 0.6 ? <ThumbsUp size={56} color={orange} /> : <BookOpen size={56} color="#dc2626" />}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: '48px', fontWeight: '800', color: getScoreColour(score, totalQuestions) }}>{score}/{totalQuestions}</p>
            <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: getScoreColour(score, totalQuestions) }}>{Math.round((score / totalQuestions) * 100)}%</p>
            <p style={{ margin: '0 0 24px', fontSize: '15px', color: '#374151' }}>{getScoreMessage(score, totalQuestions)}</p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#059669' }}>{score}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#065f46' }}>Correct</p>
              </div>
              <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>{totalQuestions - score}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#991b1b' }}>Incorrect</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={resetTest} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => setActiveTab('review')} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Review Answers</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEW TAB ── */}
      {activeTab === 'review' && (
        <div>
          <div className="learner-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: 0 }}>Answer Review</h2>
            <button onClick={resetTest} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: orange, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>New Test</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {testQuestions.map((q, index) => {
              const userAnswer = answers[q.question_id]
              const isCorrect = userAnswer === q.correct_answer
              return (
                <div key={q.question_id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${isCorrect ? '#059669' : '#dc2626'}` }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: isCorrect ? '#d1fae5' : '#fee2e2', color: isCorrect ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111827', lineHeight: '1.5' }}>{q.question_text}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: isCorrect ? '#f0fdf4' : '#fff1f2', border: `1px solid ${isCorrect ? '#6ee7b7' : '#fca5a5'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex' }}>{isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '11px', color: isCorrect ? '#065f46' : '#991b1b', fontWeight: '600' }}>Your answer</p>
                        <p style={{ margin: 0, fontSize: '13px', color: isCorrect ? '#065f46' : '#dc2626', fontWeight: '700' }}>
                          {userAnswer}
                          {q.question_type === 'multiple_choice' && userAnswer && (
                            <span style={{ fontWeight: '400', marginLeft: '8px' }}>— {getOptionText(q, userAnswer)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {!isCorrect && (
                      <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex' }}><CheckCircle size={16} /></span>
                        <div>
                          <p style={{ margin: 0, fontSize: '11px', color: '#065f46', fontWeight: '600' }}>Correct answer</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#059669', fontWeight: '700' }}>
                            {q.correct_answer}
                            {q.question_type === 'multiple_choice' && (
                              <span style={{ fontWeight: '400', marginLeft: '8px' }}>— {getOptionText(q, q.correct_answer)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {q.explanation && (
                      <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#92400e', lineHeight: '1.5' }}>
                          <strong>Explanation:</strong> {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={resetTest} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: orange, color: 'white', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Rocket size={16} /> Start New Test
          </button>
        </div>
      )}

    </div>
  )
}
