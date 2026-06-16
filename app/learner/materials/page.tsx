'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'


type Material = {
  material_id: string
  title: string
  description?: string
  category: string
  file_name: string
  file_url: string
  created_at: string
}

const supabase = createClient()

export default function LearnerMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const categories = [
    { id: 'road_signs',       label: 'Road Signs',       icon: '🚦' },
    { id: 'highway_code',     label: 'Highway Code',     icon: '📖' },
    { id: 'practical_guides', label: 'Practical Guides', icon: '🚗' },
    { id: 'test_preparation', label: 'Test Preparation', icon: '📝' },
    { id: 'safety',           label: 'Safety',           icon: '⛑' },
    { id: 'other',            label: 'Other',            icon: '📄' },
  ]

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadMaterials = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data } = await supabase
      .from('learning_materials')
      .select('*')
      .order('created_at', { ascending: false })

    setMaterials(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadMaterials()
    }
    init()
    return () => { cancelled = true }
  }, [loadMaterials])

  // ─── Derived state ────────────────────────────────────────────────────────────

  const filteredMaterials = materials.filter(m => {
    const matchesSearch =
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterCategory === 'all' || m.category === filterCategory
    return matchesSearch && matchesFilter
  })

  function getCategoryIcon(cat: string) {
    return categories.find(c => c.id === cat)?.icon || '📄'
  }

  function getCategoryLabel(cat: string) {
    return categories.find(c => c.id === cat)?.label || cat
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Materials...</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>📚 Learning Materials</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Browse and download study materials</p>
        </div>
        <button
          onClick={() => router.push('/learner/dashboard')}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: blue, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          ← Dashboard
        </button>
      </div>

      {/* Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${blue}, #2d4fa3)`,
        borderRadius: '14px', padding: '20px 24px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>
            Study Resources
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: 0 }}>
            {materials.length} material(s) available for download
          </p>
        </div>
        <span style={{ fontSize: '40px' }}>📚</span>
      </div>

      {/* Category stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {categories.map(cat => {
          const count = materials.filter(m => m.category === cat.id).length
          if (count === 0) return null
          const isActive = filterCategory === cat.id
          return (
            <div key={cat.id}
              onClick={() => setFilterCategory(isActive ? 'all' : cat.id)}
              style={{ background: isActive ? `linear-gradient(135deg, ${blue}, ${orange})` : 'white', borderRadius: '12px', padding: '14px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: isActive ? 'none' : '1px solid #f3f4f6', transition: 'all 0.2s ease' }}
            >
              <p style={{ margin: '0 0 4px', fontSize: '22px' }}>{cat.icon}</p>
              <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: '800', color: isActive ? 'white' : blue }}>{count}</p>
              <p style={{ margin: 0, fontSize: '10px', color: isActive ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>{cat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <input
          type="text"
          placeholder="🔍 Search materials by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }}
        />
      </div>

      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📚</p>
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>No materials found</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            {materials.length === 0
              ? 'No learning materials have been uploaded yet. Check back soon.'
              : 'No materials match your search. Try a different keyword.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredMaterials.map(material => (
            <div key={material.material_id}
              style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              {/* Icon and title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '52px', height: '52px', background: '#fee2e2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>
                  📕
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {material.title}
                  </p>
                  <span style={{ background: lightBlue, color: blue, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}>
                    {getCategoryIcon(material.category)} {getCategoryLabel(material.category)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {material.description && (
                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                  {material.description}
                </p>
              )}

              {/* File name */}
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                📎 {material.file_name}
              </p>

              {/* Date */}
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                Added {new Date(material.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>

              {/* Download button — fixed missing opening <a tag */}
              <a
                href={material.file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', width: '100%', padding: '10px', borderRadius: '10px', background: `linear-gradient(135deg, ${blue}, ${orange})`, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', textDecoration: 'none', textAlign: 'center', marginTop: 'auto', boxSizing: 'border-box' }}
              >
                📥 View and Download PDF
              </a>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
