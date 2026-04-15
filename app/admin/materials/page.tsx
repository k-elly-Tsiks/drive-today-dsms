'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const categories = [
    { id: 'road_signs', label: 'Road Signs', icon: '🚦' },
    { id: 'highway_code', label: 'Highway Code', icon: '📖' },
    { id: 'practical_guides', label: 'Practical Guides', icon: '🚗' },
    { id: 'test_preparation', label: 'Test Preparation', icon: '📝' },
    { id: 'safety', label: 'Safety', icon: '⛑' },
    { id: 'other', label: 'Other', icon: '📄' },
  ]

  useEffect(() => {
    (async () => {
      const loadMaterials = async () => {
        setLoading(true)
        const { data } = await supabase
          .from('learning_materials')
          .select('*')
          .order('created_at', { ascending: false })
        setMaterials(data || [])
        setLoading(false)
      }

      const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('user_id', user.id)
          .single()
        if (data?.role !== 'admin') router.push('/login')
      }

      await checkAdmin()
      await loadMaterials()
    })()
  }, [router, supabase])

  const loadMaterials = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('learning_materials')
      .select('*')
      .order('created_at', { ascending: false })
    setMaterials(data || [])
    setLoading(false)
  }

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

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}_${selectedFile.name.replace(/\s/g, '_')}`

    const { error: uploadError } = await supabase.storage
      .from('learning-materials')
      .upload(fileName, selectedFile)

    if (uploadError) {
      setError('Failed to upload file. Please try again.')
      setUploading(false)
      return
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('learning-materials')
      .getPublicUrl(fileName)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Save to database
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
    // Extract file name from URL
    const fileName = fileUrl.split('/').pop()

    if (fileName) {
      await supabase.storage
        .from('learning-materials')
        .remove([fileName])
    }

    const { error } = await supabase
      .from('learning_materials')
      .delete()
      .eq('material_id', materialId)

    if (error) {
      setError('Failed to delete material.')
      setTimeout(() => setError(''), 3000)
      return
    }

    setSuccessMessage('Material deleted successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadMaterials()
  }

  // Filter and search
  const filteredMaterials = materials.filter(m => {
    const matchesSearch =
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filterCategory === 'all' || m.category === filterCategory
    return matchesSearch && matchesFilter
  })

  function getCategoryIcon(cat: string) {
    return categories.find(c => c.id === cat)?.icon || '📄'
  }

  function getCategoryLabel(cat: string) {
    return categories.find(c => c.id === cat)?.label || cat
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: lightBlue,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px', fontWeight: '800', color: 'white',
          }}>DT</div>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Materials...</p>
      </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            📚 Learning Materials
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Upload and manage PDF learning materials for learners
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setShowModal(true); setError('') }}
          style={{
            padding: '10px 18px', borderRadius: '10px',
            border: 'none',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            color: 'white', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer',
          }}
        >
          + Upload Material
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
        <div style={{
          background: '#d1fae5', border: '1px solid #6ee7b7',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '16px', color: '#065f46',
          fontSize: '13px', fontWeight: '600',
        }}>
          ✅ {successMessage}
        </div>
      )}
      {error && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '16px', color: '#991b1b',
          fontSize: '13px', fontWeight: '600',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '16px', textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          borderTop: `3px solid ${blue}`,
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: blue }}>
            {materials.length}
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Total Materials</p>
        </div>
        {categories.map(cat => (
          <div key={cat.id} style={{
            background: 'white', borderRadius: '12px',
            padding: '16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${orange}`,
          }}>
            <p style={{ margin: '0 0 2px', fontSize: '20px' }}>{cat.icon}</p>
            <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800', color: orange }}>
              {materials.filter(m => m.category === cat.id).length}
            </p>
            <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>{cat.label}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '16px 20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '12px',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="🔍 Search by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px',
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory('all')}
            style={{
              padding: '8px 14px', borderRadius: '20px',
              border: filterCategory === 'all' ? 'none' : '1px solid #e5e7eb',
              background: filterCategory === 'all'
                ? `linear-gradient(135deg, ${blue}, ${orange})`
                : 'white',
              color: filterCategory === 'all' ? 'white' : '#6b7280',
              fontSize: '12px', fontWeight: '700', cursor: 'pointer',
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                border: filterCategory === cat.id ? 'none' : '1px solid #e5e7eb',
                background: filterCategory === cat.id
                  ? `linear-gradient(135deg, ${blue}, ${orange})`
                  : 'white',
                color: filterCategory === cat.id ? 'white' : '#6b7280',
                fontSize: '12px',
                fontWeight: filterCategory === cat.id ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '60px', textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📚</p>
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 4px' }}>
            No materials found
          </p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            Click Upload Material to add your first PDF
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {filteredMaterials.map((material) => (
            <div
              key={material.material_id}
              style={{
                background: 'white', borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #f3f4f6',
                display: 'flex', flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* PDF Icon and Category */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px', height: '48px',
                  background: '#fee2e2', borderRadius: '10px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '24px',
                  flexShrink: 0,
                }}>
                  📕
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: '14px',
                    fontWeight: '700', color: '#111827',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {material.title}
                  </p>
                  <span style={{
                    background: lightBlue, color: blue,
                    padding: '2px 8px', borderRadius: '10px',
                    fontSize: '10px', fontWeight: '600',
                  }}>
                    {getCategoryIcon(material.category)} {getCategoryLabel(material.category)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {material.description && (
                <p style={{
                  margin: 0, fontSize: '12px', color: '#6b7280',
                  lineHeight: '1.5',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}>
                  {material.description}
                </p>
              )}

              {/* File name */}
              <p style={{
                margin: 0, fontSize: '11px', color: '#9ca3af',
                whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                📎 {material.file_name}
              </p>

              {/* Date */}
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                Uploaded {new Date(material.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <a
                  href={material.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 2, padding: '8px',
                    borderRadius: '8px', border: 'none',
                    background: `linear-gradient(135deg, ${blue}, ${orange})`,
                    color: 'white', fontSize: '12px',
                    fontWeight: '700', cursor: 'pointer',
                    textDecoration: 'none', textAlign: 'center',
                  }}
                >
                  View PDF
                </a>
                <button
                  onClick={() => deleteMaterial(material.material_id, material.file_url)}
                  style={{
                    flex: 1, padding: '8px',
                    borderRadius: '8px', border: 'none',
                    background: '#fee2e2', color: '#991b1b',
                    fontSize: '12px', fontWeight: '700',
                    cursor: 'pointer',
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
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '20px',
            padding: '32px', width: '100%',
            maxWidth: '480px', margin: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>
              Upload Learning Material
            </h2>

            {error && (
              <div style={{
                background: '#fee2e2', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#991b1b', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Title */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Road Signs Study Guide"
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what this material covers..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                    resize: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Category */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '8px',
                }}>
                  Category *
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '10px',
                        border: category === cat.id
                          ? 'none' : '1px solid #e5e7eb',
                        background: category === cat.id
                          ? `linear-gradient(135deg, ${blue}, ${orange})`
                          : 'white',
                        color: category === cat.id ? 'white' : '#6b7280',
                        fontSize: '12px', fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  PDF File * (max 10MB)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${selectedFile ? orange : '#e5e7eb'}`,
                    borderRadius: '10px', padding: '24px',
                    textAlign: 'center', cursor: 'pointer',
                    background: selectedFile ? '#fff7ed' : '#fafafa',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {selectedFile ? (
                    <>
                      <p style={{ margin: '0 0 4px', fontSize: '24px' }}>📕</p>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: orange }}>
                        {selectedFile.name}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 4px', fontSize: '32px' }}>📎</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                        Click to select a PDF file
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                        PDF files only, maximum 10MB
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
              </div>

            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  setShowModal(false)
                  setTitle('')
                  setDescription('')
                  setCategory('')
                  setSelectedFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                  setError('')
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  color: '#374151', fontSize: '14px',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={uploadMaterial}
                disabled={uploading}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px',
                  border: 'none',
                  background: uploading
                    ? '#e5e7eb'
                    : `linear-gradient(135deg, ${blue}, ${orange})`,
                  color: uploading ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? 'Uploading...' : 'Upload Material'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}