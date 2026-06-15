'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Upload, BookOpen, } from 'lucide-react'

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

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const primary = '#FF5A1F'

  // Insert keyframes dynamically to guarantee animation runs out-of-the-box
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

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('learning_materials').select('*').order('created_at', { ascending: false })
    setMaterials(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      await loadMaterials()
    }
    init()
  }, [loadMaterials, router])

  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory(''); setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError('')
  }

  async function uploadMaterial() {
    if (!title || !selectedFile) { setError('Please fill in all required fields and select a file.'); return }
    setUploading(true)
    const fileName = `${Date.now()}_${selectedFile.name.replace(/\s/g, '_')}`
    const { error: uploadError } = await supabase.storage.from('learning-materials').upload(fileName, selectedFile)
    if (uploadError) { setError('Failed to upload.'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('learning-materials').getPublicUrl(fileName)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: dbError } = await supabase.from('learning_materials').insert({
      title, description, category, file_url: urlData.publicUrl, file_name: selectedFile.name, uploaded_by: user?.id,
    })
    if (dbError) { setError('Failed to save.'); setUploading(false); return }
    setSuccessMessage(`${title} uploaded successfully.`)
    setShowUploadForm(false); resetForm(); setUploading(false); loadMaterials()
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  async function deleteMaterial(materialId: string, fileUrl: string) {
    const fileName = fileUrl.split('/').pop()
    if (fileName) {
      await supabase.storage.from('learning-materials').remove([fileName])
    }
    await supabase.from('learning_materials').delete().eq('material_id', materialId)
    loadMaterials()
  }

  const filteredMaterials = materials.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight: '100%', padding: '0 0 24px' }}>
      {successMessage && (
        <div style={{ padding: '12px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
          {successMessage}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800' }}>
          <BookOpen style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} size={24} color={primary} />
          Learning Materials
        </h1>
        <button onClick={() => setShowUploadForm(true)} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: primary, color: 'white', fontWeight: '700', cursor: 'pointer' }}>+ Upload Material</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showUploadForm ? '400px 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>
        {showUploadForm && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Upload style={{ color: primary }} size={20} />
                <h2 style={{ color: textDark, fontSize: '16px', fontWeight: '800', margin: '0' }}>Upload Curriculum Book</h2>
              </div>
              <button onClick={() => setShowUploadForm(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: textMuted }}>&times;</button>
            </div>
            {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '13px' }}>{error}</div>}
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} style={{ width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
            
            <div onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${selectedFile ? textDark : '#e2e8f0'}`, borderRadius: '8px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: selectedFile ? '#F8FAFC' : 'white' }}>
              {selectedFile ? (
                <div><p style={{ fontSize: '28px', margin: '0 0 10px' }}>📕</p><p style={{ fontWeight: 700, fontSize: '13px', color: textDark, margin: 0 }}>{selectedFile.name}</p></div>
              ) : (
                <div><p style={{ fontSize: '28px', color: '#cbd5e1', margin: '0 0 10px' }}>☁️</p><p style={{ fontWeight: 700, fontSize: '13px', color: textDark, margin: 0 }}>PDF Manual / Document Picker</p><p style={{ fontSize: '11px', color: textMuted, marginTop: '4px' }}>Click or drag a .pdf file under 25MB.</p></div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            <button onClick={uploadMaterial} disabled={uploading} style={{ width: '100%', marginTop: '24px', padding: '14px', background: primary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>{uploading ? 'Processing...' : 'Upload Curriculum Book'}</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <input type="text" placeholder="Search books..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {loading ? (
              // Beautiful matching skeleton layout!
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                      <Skeleton w="44px" h="44px" r="10px" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <Skeleton w="75%" h="16px" r="4px" />
                      <Skeleton w="35%" h="11px" r="4px" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
                    <Skeleton w="100%" h="13px" r="4px" />
                    <Skeleton w="90%" h="13px" r="4px" />
                    <Skeleton w="45%" h="13px" r="4px" />
                  </div>
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px' }}>
                    <Skeleton w="60%" h="11px" r="4px" />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '4px' }}>
                    <div style={{ flex: 1, height: '40px', borderRadius: '8px', overflow: 'hidden' }}>
                      <Skeleton w="100%" h="100%" r="8px" />
                    </div>
                    <div style={{ width: '70px', height: '40px', borderRadius: '8px', overflow: 'hidden' }}>
                      <Skeleton w="100%" h="100%" r="8px" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredMaterials.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: textMuted }}>
                No materials found.
              </div>
            ) : filteredMaterials.map((material: Material) => (
              <div key={material.material_id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={22} color={primary} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{material.title}</h3>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: textMuted }}>{material.description || 'No description available'}</p>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', fontSize: '13px', color: textMuted }}>
                  <strong>File:</strong> {material.file_name}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <a href={material.file_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', textDecoration: 'none', color: textDark, fontWeight: 700 }}>Download</a>
                  <button onClick={() => deleteMaterial(material.material_id, material.file_url)} style={{ padding: '12px 18px', borderRadius: '10px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}