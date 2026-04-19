import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import { gerarListaPresencaPDF, formatarData } from '../lib/pdf'

export default function Registros() {
  const { isCoord, user } = useAuth()
  const toast = useToast()
  const [atividades, setAtividades] = useState([])
  const [registros, setRegistros] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})
  const [expandido, setExpandido] = useState(null)
  const fileInputRef = useRef()
  const [atividadeUpload, setAtividadeUpload] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: ats } = await supabase.from('atividades').select('*')
      .eq('status', 'realizada').order('data', { ascending: false })
    setAtividades(ats || [])
    if (ats?.length) {
      const ids = ats.map(a => a.id)
      const { data: regs } = await supabase.from('registros').select('*').in('atividade_id', ids).order('criado_em')
      const map = {}
      ;(regs || []).forEach(r => {
        if (!map[r.atividade_id]) map[r.atividade_id] = []
        map[r.atividade_id].push(r)
      })
      setRegistros(map)
    }
    setLoading(false)
  }

  async function uploadFotos(atividadeId, files) {
    setUploading(u => ({ ...u, [atividadeId]: true }))
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${atividadeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('atividades').upload(path, file)
      if (upErr) { toast('Erro no upload: ' + upErr.message, 'error'); continue }
      const { data: { publicUrl } } = supabase.storage.from('atividades').getPublicUrl(path)
      await supabase.from('registros').insert({
        atividade_id: atividadeId,
        tipo: file.type.startsWith('image/') ? 'foto' : 'documento',
        nome: file.name,
        arquivo_url: publicUrl,
        tamanho_bytes: file.size,
        criado_por: user?.id,
      })
    }
    toast(`${files.length} arquivo(s) enviado(s) com sucesso!`)
    setUploading(u => ({ ...u, [atividadeId]: false }))
    load()
  }

  async function removerRegistro(id, url) {
    if (!confirm('Remover este arquivo?')) return
    await supabase.from('registros').delete().eq('id', id)
    toast('Arquivo removido.')
    load()
  }

  function handleFileChange(e) {
    if (atividadeUpload && e.target.files.length > 0) {
      uploadFotos(atividadeUpload, Array.from(e.target.files))
    }
    e.target.value = ''
  }

  function abrirUpload(atividadeId) {
    setAtividadeUpload(atividadeId)
    fileInputRef.current?.click()
  }

  const formatBytes = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📸 Registros & Histórico</h1>
          <p className="page-subtitle">Fotos, documentos e memórias das atividades realizadas</p>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx"
        style={{ display: 'none' }} onChange={handleFileChange} />

      {atividades.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📸</span>
          <h3>Nenhuma atividade realizada ainda</h3>
          <p>Os registros aparecerão aqui após marcar atividades como realizadas.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {atividades.map(a => {
            const regs = registros[a.id] || []
            const fotos = regs.filter(r => r.tipo === 'foto')
            const docs = regs.filter(r => r.tipo !== 'foto')
            const isOpen = expandido === a.id

            return (
              <div key={a.id} className="card">
                <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpandido(isOpen ? null : a.id)}>
                  <div>
                    <span className="card-title">📸 {a.titulo}</span>
                    <div style={{ fontSize: '12px', color: 'var(--cinza-medio)', marginTop: '3px' }}>
                      📅 {formatarData(a.data)} · 📍 {a.local || '—'} · 👧 {a.qtd_criancas || 0} crianças · 📷 {fotos.length} foto(s) · 📄 {docs.length} doc(s)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-realizada">✅ Realizada</span>
                    <span style={{ color: 'var(--cinza)', fontSize: '18px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : '' }}>▾</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="card-body">
                    {/* Ações */}
                    {isCoord && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => abrirUpload(a.id)} disabled={uploading[a.id]}>
                          {uploading[a.id] ? '⏳ Enviando...' : '📷 Enviar Fotos / Documentos'}
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => gerarListaPresencaPDF(a)}>
                          🖨️ Lista de Presença
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => gerarHistoricoPDF(a, regs)}>
                          📄 Exportar Histórico PDF
                        </button>
                      </div>
                    )}

                    {/* Fotos */}
                    {fotos.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                          📷 Fotos ({fotos.length})
                        </div>
                        <div className="foto-grid">
                          {fotos.map(f => (
                            <div key={f.id} className="foto-thumb" style={{ position: 'relative' }}>
                              <img src={f.arquivo_url} alt={f.nome} style={{ cursor: 'pointer' }}
                                onClick={() => window.open(f.arquivo_url, '_blank')} />
                              {isCoord && (
                                <button onClick={() => removerRegistro(f.id, f.arquivo_url)}
                                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(192,57,43,0.9)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', padding: '2px 6px', fontSize: '11px' }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documentos */}
                    {docs.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                          📄 Documentos ({docs.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {docs.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--creme)', borderRadius: '8px', border: '1px solid var(--borda)' }}>
                              <span style={{ fontSize: '20px' }}>📄</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--azul)' }}>{d.nome}</div>
                                {d.tamanho_bytes && <div style={{ fontSize: '11px', color: 'var(--cinza)' }}>{formatBytes(d.tamanho_bytes)}</div>}
                              </div>
                              <a href={d.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">⬇ Baixar</a>
                              {isCoord && <button className="btn btn-sm btn-danger" onClick={() => removerRegistro(d.id, d.arquivo_url)}>🗑</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {regs.length === 0 && (
                      <div className="upload-area" onClick={() => isCoord && abrirUpload(a.id)}
                        style={{ cursor: isCoord ? 'pointer' : 'default' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                        <p style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--cinza-medio)' }}>
                          {isCoord ? 'Clique para enviar fotos e documentos desta atividade' : 'Nenhum arquivo enviado ainda'}
                        </p>
                        {isCoord && <p style={{ fontSize: '12px', color: 'var(--cinza)', marginTop: '4px' }}>Suporta imagens, PDF, Word</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function gerarHistoricoPDF(atividade, registros) {
  const fotos = registros.filter(r => r.tipo === 'foto')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Histórico — ${atividade.titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #1e2a3a; }
    .header { text-align:center; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #c9a227; }
    h1 { font-size:20px; color:#1a3a6b; margin:4px 0; }
    .info { background:#f2f5fb; padding:14px 18px; border-radius:10px; margin-bottom:20px; font-size:13px; }
    .info table { width:100%; } .info td { padding:4px 8px; }
    .info td:first-child { font-weight:700; color:#1a3a6b; width:130px; }
    .fotos { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:16px; }
    .fotos img { width:100%; border-radius:6px; aspect-ratio:1; object-fit:cover; }
    h2 { font-size:15px; color:#1a3a6b; margin:20px 0 10px; border-bottom:1px solid #dce3f0; padding-bottom:6px; }
    .footer { margin-top:28px; text-align:center; font-size:11px; color:#888; border-top:1px solid #dce3f0; padding-top:14px; }
    @media print { button { display:none!important } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase">Instituto Nossa Senhora Menina</div>
    <h1>Histórico de Atividade</h1>
    <div style="font-size:12px;color:#888;margin-top:4px">${atividade.titulo}</div>
  </div>
  <div class="info">
    <table>
      <tr><td>Data</td><td>${atividade.data ? new Date(atividade.data + 'T12:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) : '—'}</td></tr>
      <tr><td>Local</td><td>${atividade.local || '—'}</td></tr>
      <tr><td>Tema</td><td>${atividade.tema || '—'}</td></tr>
      <tr><td>Crianças</td><td>${atividade.qtd_criancas || 0}</td></tr>
      <tr><td>Adultos</td><td>${atividade.qtd_adultos || 0}</td></tr>
      <tr><td>Total</td><td><strong>${(atividade.qtd_criancas || 0) + (atividade.qtd_adultos || 0)}</strong></td></tr>
    </table>
    ${atividade.descricao ? `<p style="margin-top:10px"><strong>Descrição:</strong> ${atividade.descricao}</p>` : ''}
    ${atividade.insumos ? `<p style="margin-top:6px"><strong>Insumos usados:</strong> ${atividade.insumos}</p>` : ''}
  </div>
  ${fotos.length > 0 ? `<h2>📷 Registros Fotográficos (${fotos.length})</h2><div class="fotos">${fotos.map(f => `<img src="${f.arquivo_url}" alt="${f.nome}">`).join('')}</div>` : ''}
  <div class="footer">✦ Instituto Nossa Senhora Menina · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  <div style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir / Salvar PDF</button>
  </div>
</body>
</html>`
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
}
