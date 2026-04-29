'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Material {
  material_id: string
  title: string
  description: string | null
  category: string
  file_url: string
  file_name: string
  uploaded_by: string
  created_at: string
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

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Modals state
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const routerRef = useRef(router)

  // Design tokens
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const primary = '#3b82f6'

  const categories = [
    { id: 'road_signs', label: 'Road Signs', icon: '🚦', color: '#ef4444' },
    { id: 'highway_code', label: 'Highway Code', icon: '📖', color: '#f59e0b' },
    { id: 'practical_guides', label: 'Practical Guides', icon: '🚗', color: '#10b981' },
    { id: 'test_preparation', label: 'Test Preparation', icon: '📝', color: '#8b5cf6' },
    { id: 'safety', label: 'Safety', icon: '⛑', color: '#ec4899' },
    { id: 'other', label: 'Other', icon: '📄', color: '#64748b' },
  ]

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('learning_materials')
      .select('*')
      .order('created_at', { ascending: false })
    setMaterials(data || [])
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
    await loadMaterials()
  }, [loadMaterials])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await checkAdmin()
    }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function uploadMaterial() {
    if (!title || !category || !selectedFile) {
      setError('Please fill in all required fields and select a file.')
      return
    }

    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are allowed.')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.')
      return
    }

    setUploading(true)
    setError('')

    const fileName = `${Date.now()}_${selectedFile.name.replace(/\s/g, '_')}`

    const { error: uploadError } = await supabase.storage
      .from('learning-materials')
      .upload(fileName, selectedFile)

    if (uploadError) {
      setError('Failed to upload file. Please try again.')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('learning-materials')
      .getPublicUrl(fileName)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: dbError } = await supabase
      .from('learning_materials')
      .insert({
        title,
        description: description || null,
        category,
        file_url: urlData.publicUrl,
        file_name: selectedFile.name,
        uploaded_by: user?.id,
      })

    if (dbError) {
      setError('Failed to save material details.')
      setUploading(false)
      return
    }

    setSuccessMessage(`${title} uploaded successfully.`)
    setTimeout(() => setSuccessMessage(''), 3000)
    
    setShowModal(false)
    setTitle('')
    setDescription('')
    setCategory('')
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
    loadMaterials()
  }

  async function deleteMaterial(materialId: string, fileUrl: string) {
    const fileName = fileUrl.split('/').pop()

    if (fileName) {
      await supabase.storage
        .from('learning-materials')
        .remove([fileName])
    }

    const { error: deleteError } = await supabase
      .from('learning_materials')
      .delete()
      .eq('material_id', materialId)

    if (deleteError) {
      setError('Failed to delete material.')
      setTimeout(() => setError(''), 3000)
      return
    }

    setSuccessMessage('Material deleted successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadMaterials()
  }

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

  const handleCardClick = (catId: string) => {
    setFilterCategory(catId)
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
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>📚 Learning Materials</h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>Upload and manage PDF learning materials for learners</p>
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
              onClick={() => { setShowModal(true); setError('') }}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none',
                background: primary, color: 'white', fontSize: '13px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              + Upload Material
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {loading ? (
             Array(4).fill(0).map((_, i) => (
               <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <Skeleton h="28px" w="40px" r="6px" />
                 <div style={{ marginTop: '8px' }}><Skeleton h="11px" w="70%" r="4px" /></div>
               </div>
             ))
          ) : (
            <>
              <div 
                onClick={() => handleCardClick('all')}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
                style={{
                  background: 'white', borderRadius: '10px', padding: '20px 22px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${textDark}`,
                  cursor: 'pointer', transition: 'transform 0.15s',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>{materials.length}</p>
                <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '500' }}>Total Materials</p>
              </div>
              {categories.slice(0, 3).map(cat => (
                <div 
                  key={cat.id} 
                  onClick={() => handleCardClick(cat.id)}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
                  style={{
                    background: 'white', borderRadius: '10px', padding: '20px 22px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${cat.color}`,
                    cursor: 'pointer', transition: 'transform 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>
                      {materials.filter(m => m.category === cat.id).length}
                    </p>
                    <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '500' }}>{cat.label}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Search and Filter */}
        <div style={{
          background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input
            type="text"
            placeholder="🔍 Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterCategory('all')}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                border: filterCategory === 'all' ? 'none' : '1px solid #e2e8f0',
                background: filterCategory === 'all' ? textDark : 'white',
                color: filterCategory === 'all' ? 'white' : textMuted,
                fontSize: '12px', fontWeight: filterCategory === 'all' ? '700' : '500',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              All Categories
            </button>
            {categories.map(cat => (
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
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Materials Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {Array(6).fill(0).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <Skeleton w="40px" h="40px" r="8px" />
                  <div style={{ flex: 1 }}><Skeleton w="80%" h="14px" r="4px" /><div style={{ marginTop: '6px' }}><Skeleton w="40%" h="10px" r="4px" /></div></div>
                </div>
                <Skeleton w="100%" h="10px" r="4px" />
                <div style={{ marginTop: '6px' }}><Skeleton w="90%" h="10px" r="4px" /></div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}><Skeleton w="100%" h="32px" r="8px" /></div>
              </div>
            ))}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '10px', padding: '60px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: '32px', marginBottom: '12px' }}>📚</p>
            <p style={{ color: textDark, fontSize: '14px', fontWeight: '600', margin: '0 0 4px' }}>No materials found</p>
            <p style={{ color: textMuted, fontSize: '13px', margin: 0, fontWeight: '500' }}>Adjust filters or click Upload Material to add one.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredMaterials.map((material) => (
              <div
                key={material.material_id}
                style={{
                  background: 'white', borderRadius: '10px', padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', background: '#f8fafc', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                    flexShrink: 0, border: '1px solid #f1f5f9'
                  }}>
                    📕
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: textDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {material.title}
                    </p>
                    <span style={{ background: '#f1f5f9', color: textMuted, padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', marginTop: '4px', display: 'inline-block' }}>
                      {getCategoryIcon(material.category)} {getCategoryLabel(material.category)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {material.description ? (
                  <p style={{ margin: 0, fontSize: '12px', color: textMuted, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '36px' } as React.CSSProperties}>
                    {material.description}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', height: '36px' }}>No description provided.</p>
                )}

                {/* Meta details */}
                <div style={{ marginTop: 'auto', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong>File:</strong> {material.file_name}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>
                    <strong>Added:</strong> {new Date(material.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <a
                    href={material.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0',
                      background: 'white', color: textDark, fontSize: '12px', fontWeight: '700',
                      cursor: 'pointer', textDecoration: 'none', textAlign: 'center', transition: 'all 0.2s'
                    }}
                  >
                    View PDF
                  </a>
                  <button
                    onClick={() => deleteMaterial(material.material_id, material.file_url)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #fee2e2',
                      background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── UPLOAD MODAL ── */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '480px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>Upload Learning Material</h2>

              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Title *</label>
                  <input
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Road Signs Study Guide"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Description (optional)</label>
                  <textarea
                    value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Briefly describe what this material covers..." rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Category *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {categories.map(cat => (
                      <button
                        key={cat.id} type="button" onClick={() => setCategory(cat.id)}
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

                {/* File Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>PDF File * (max 10MB)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${selectedFile ? textDark : '#cbd5e1'}`, borderRadius: '8px', padding: '24px',
                      textAlign: 'center', cursor: 'pointer', background: selectedFile ? '#f8fafc' : '#f1f5f9', transition: 'all 0.2s ease',
                    }}
                  >
                    {selectedFile ? (
                      <>
                        <p style={{ margin: '0 0 4px', fontSize: '24px' }}>📕</p>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: textDark }}>{selectedFile.name}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: textMuted }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 4px', fontSize: '24px' }}>📎</p>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: textDark }}>Click to select a PDF file</p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: textMuted }}>PDF files only, maximum 10MB</p>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    setShowModal(false); setTitle(''); setDescription(''); setCategory('');
                    setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; setError('');
                  }}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={uploadMaterial} disabled={uploading}
                  style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: uploading ? '#cbd5e1' : primary, color: 'white', fontSize: '14px', fontWeight: '700', cursor: uploading ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? 'Uploading...' : 'Upload Material'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
