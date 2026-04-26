import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import { gerarListaPresencaPDF } from "../lib/pdf";
import { formatarData } from "../lib/utils";
import Modal from '../components/Modal'

export default function Registros() {
  const { isCoord, user } = useAuth()
  const toast = useToast()
  const [atividades, setAtividades] = useState([])
  const [registros, setRegistros] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})
  const [expandido, setExpandido] = useState(null)
  const [modalPresenca, setModalPresenca] = useState(null)
  const [presencaForm, setPresencaForm] = useState({ real_criancas:'', real_adultos:'' })
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef()
  const [atividadeUpload, setAtividadeUpload] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: ats } = await supabase.from('atividades').select('*').eq('status','realizada').order('data', { ascending: false })
    setAtividades(ats || [])
    if (ats?.length) {
      const ids = ats.map(a => a.id)
      const { data: regs } = await supabase.from('registros').select('*').in('atividade_id', ids).order('criado_em')
      const map = {}
      ;(regs||[]).forEach(r => { if(!map[r.atividade_id]) map[r.atividade_id]=[]; map[r.atividade_id].push(r) })
      setRegistros(map)
    }
    setLoading(false)
  }

  async function uploadFotos(atividadeId, files) {
    setUploading(u=>({...u,[atividadeId]:true}))
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${atividadeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('atividades').upload(path, file)
      if (upErr) { toast('Erro no upload: '+upErr.message,'error'); continue }
      const { data: { publicUrl } } = supabase.storage.from('atividades').getPublicUrl(path)
      await supabase.from('registros').insert({ atividade_id:atividadeId, tipo:file.type.startsWith('image/')?'foto':'documento', nome:file.name, arquivo_url:publicUrl, tamanho_bytes:file.size, criado_por:user?.id })
    }
    toast(`${files.length} arquivo(s) enviado(s)!`)
    setUploading(u=>({...u,[atividadeId]:false}))
    load()
  }

  async function salvarPresencaReal() {
    if (!modalPresenca) return
    setSaving(true)
    const { error } = await supabase.from('atividades').update({
      real_criancas: parseInt(presencaForm.real_criancas) || null,
      real_adultos: parseInt(presencaForm.real_adultos) || null,
      atualizado_em: new Date().toISOString()
    }).eq('id', modalPresenca.id)
    if (error) toast('Erro: '+error.message,'error')
    else { toast('Presença real registrada!'); setModalPresenca(null); load() }
    setSaving(false)
  }

  async function removerRegistro(id) {
    if (!confirm('Remover este arquivo?')) return
    await supabase.from('registros').delete().eq('id',id)
    toast('Arquivo removido.'); load()
  }

  function handleFileChange(e) {
    if (atividadeUpload && e.target.files.length>0) uploadFotos(atividadeUpload, Array.from(e.target.files))
    e.target.value=''
  }

  function abrirUpload(atividadeId) { setAtividadeUpload(atividadeId); fileInputRef.current?.click() }

  const formatBytes = b => b<1024*1024?`${(b/1024).toFixed(0)} KB`:`${(b/1024/1024).toFixed(1)} MB`

  if (loading) return <div className="loading-center"><div className="spinner"/></div>

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">📸 Registros & Histórico</h1><p className="page-subtitle">Fotos, documentos e presença real das atividades realizadas</p></div>
      </div>
      <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{display:'none'}} onChange={handleFileChange}/>

      {atividades.length===0?(
        <div className="empty-state"><span className="empty-icon">📸</span><h3>Nenhuma atividade realizada ainda</h3><p>Os registros aparecem aqui após marcar atividades como realizadas.</p></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {atividades.map(a => {
            const regs = registros[a.id]||[]
            const fotos = regs.filter(r=>r.tipo==='foto')
            const docs  = regs.filter(r=>r.tipo!=='foto')
            const isOpen = expandido===a.id
            const temPresencaReal = a.real_criancas!=null || a.real_adultos!=null
            const diffCriancas = temPresencaReal ? (a.real_criancas||0)-(a.qtd_criancas||0) : null
            const diffAdultos  = temPresencaReal ? (a.real_adultos||0)-(a.qtd_adultos||0) : null

            return (
              <div key={a.id} className="card">
                <div className="card-header" style={{cursor:'pointer'}} onClick={()=>setExpandido(isOpen?null:a.id)}>
                  <div>
                    <span className="card-title">📸 {a.titulo}</span>
                    <div style={{fontSize:12,color:'var(--cinza-medio)',marginTop:3}}>
                      📅 {formatarData(a.data)} · 📍 {a.local||'—'} · 📷 {fotos.length} foto(s) · 📄 {docs.length} doc(s)
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    {/* Badge presença real */}
                    {temPresencaReal?(
                      <span style={{fontSize:11,background:'var(--verde-bg)',color:'var(--verde)',padding:'3px 9px',borderRadius:20,fontWeight:700}}>
                        ✅ Presença registrada
                      </span>
                    ):(
                      <span style={{fontSize:11,background:'var(--dourado-bg)',color:'var(--dourado)',padding:'3px 9px',borderRadius:20,fontWeight:700}}>
                        ⏳ Presença pendente
                      </span>
                    )}
                    <span className="badge badge-realizada">✅ Realizada</span>
                    <span style={{color:'var(--cinza)',fontSize:18,transition:'transform .2s',transform:isOpen?'rotate(180deg)':''}}>▾</span>
                  </div>
                </div>

                {isOpen&&(
                  <div className="card-body">
                    {/* ── Comparativo estimado x real ── */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:20}}>
                      {/* Estimado */}
                      <div style={{background:'var(--azul-suave)',borderRadius:10,padding:'14px 16px'}}>
                        <div style={{fontSize:11,fontWeight:800,color:'var(--azul)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>📋 Estimado (planejamento)</div>
                        <div style={{display:'flex',gap:16}}>
                          <div><div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:'var(--azul)',lineHeight:1}}>{a.qtd_criancas||0}</div><div style={{fontSize:11,color:'var(--cinza-medio)'}}>crianças</div></div>
                          <div><div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:'var(--azul)',lineHeight:1}}>{a.qtd_adultos||0}</div><div style={{fontSize:11,color:'var(--cinza-medio)'}}>adultos</div></div>
                          <div><div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:'var(--azul)',lineHeight:1}}>{(a.qtd_criancas||0)+(a.qtd_adultos||0)}</div><div style={{fontSize:11,color:'var(--cinza-medio)'}}>total</div></div>
                        </div>
                      </div>

                      {/* Real */}
                      <div style={{background:temPresencaReal?'var(--verde-bg)':'var(--cinza-cl)',borderRadius:10,padding:'14px 16px',border:temPresencaReal?'1px solid rgba(46,125,82,.2)':'1px dashed var(--borda)'}}>
                        <div style={{fontSize:11,fontWeight:800,color:temPresencaReal?'var(--verde)':'var(--cinza)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>✅ Real (presença efetiva)</div>
                        {temPresencaReal?(
                          <div style={{display:'flex',gap:16}}>
                            <div>
                              <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:'var(--verde)',lineHeight:1}}>{a.real_criancas||0}</div>
                              <div style={{fontSize:11,color:'var(--cinza-medio)'}}>crianças {diffCriancas!==null&&<span style={{color:diffCriancas>=0?'var(--verde)':'var(--vermelho)',fontWeight:700}}>({diffCriancas>=0?'+':''}{diffCriancas})</span>}</div>
                            </div>
                            <div>
                              <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:'var(--verde)',lineHeight:1}}>{a.real_adultos||0}</div>
                              <div style={{fontSize:11,color:'var(--cinza-medio)'}}>adultos {diffAdultos!==null&&<span style={{color:diffAdultos>=0?'var(--verde)':'var(--vermelho)',fontWeight:700}}>({diffAdultos>=0?'+':''}{diffAdultos})</span>}</div>
                            </div>
                            <div>
                              <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:'var(--verde)',lineHeight:1}}>{(a.real_criancas||0)+(a.real_adultos||0)}</div>
                              <div style={{fontSize:11,color:'var(--cinza-medio)'}}>total</div>
                            </div>
                          </div>
                        ):(
                          <div style={{fontSize:12.5,color:'var(--cinza)',marginTop:4}}>Nenhum dado de presença real registrado ainda.</div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    {isCoord&&(
                      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
                        <button className="btn btn-sm btn-primary" onClick={()=>abrirUpload(a.id)} disabled={uploading[a.id]}>
                          {uploading[a.id]?'⏳ Enviando...':'📷 Enviar Fotos / Documentos'}
                        </button>
                        <button className="btn btn-sm btn-gold" onClick={()=>{setModalPresenca(a);setPresencaForm({real_criancas:a.real_criancas||'',real_adultos:a.real_adultos||''})}}>
                          👥 {temPresencaReal?'Atualizar':'Registrar'} Presença Real
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={()=>gerarListaPresencaPDF(a)}>🖨️ Lista de Presença</button>
                        <button className="btn btn-sm btn-ghost" onClick={()=>gerarHistoricoPDF(a,regs)}>📄 Exportar PDF</button>
                      </div>
                    )}

                    {/* Fotos */}
                    {fotos.length>0&&(
                      <div style={{marginBottom:20}}>
                        <div style={{fontSize:12,fontWeight:800,color:'var(--azul)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:10}}>📷 Fotos ({fotos.length})</div>
                        <div className="foto-grid">
                          {fotos.map(f=>(
                            <div key={f.id} className="foto-thumb" style={{position:'relative'}}>
                              <img src={f.arquivo_url} alt={f.nome} style={{cursor:'pointer'}} onClick={()=>window.open(f.arquivo_url,'_blank')}/>
                              {isCoord&&<button onClick={()=>removerRegistro(f.id)} style={{position:'absolute',top:4,right:4,background:'rgba(192,57,43,.9)',border:'none',borderRadius:4,color:'white',cursor:'pointer',padding:'2px 6px',fontSize:11}}>✕</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documentos */}
                    {docs.length>0&&(
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:'var(--azul)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:10}}>📄 Documentos ({docs.length})</div>
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {docs.map(d=>(
                            <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--creme)',borderRadius:8,border:'1px solid var(--borda)'}}>
                              <span style={{fontSize:20}}>📄</span>
                              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'var(--azul)'}}>{d.nome}</div>{d.tamanho_bytes&&<div style={{fontSize:11,color:'var(--cinza)'}}>{formatBytes(d.tamanho_bytes)}</div>}</div>
                              <a href={d.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">⬇ Baixar</a>
                              {isCoord&&<button className="btn btn-sm btn-danger" onClick={()=>removerRegistro(d.id)}>🗑</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {regs.length===0&&(
                      <div className="upload-area" onClick={()=>isCoord&&abrirUpload(a.id)} style={{cursor:isCoord?'pointer':'default'}}>
                        <div style={{fontSize:32,marginBottom:8}}>📷</div>
                        <p style={{fontSize:13.5,fontWeight:600,color:'var(--cinza-medio)'}}>{isCoord?'Clique para enviar fotos e documentos':'Nenhum arquivo enviado ainda'}</p>
                        {isCoord&&<p style={{fontSize:12,color:'var(--cinza)',marginTop:4}}>Suporta imagens, PDF, Word</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal presença real */}
      <Modal open={!!modalPresenca} onClose={()=>setModalPresenca(null)}
        title="👥 Registrar Presença Real"
        footer={<><button className="btn btn-ghost" onClick={()=>setModalPresenca(null)}>Cancelar</button><button className="btn btn-gold" onClick={salvarPresencaReal} disabled={saving}>{saving?'⏳ Salvando...':'Salvar Presença'}</button></>}>
        {modalPresenca&&(
          <>
            <div style={{fontFamily:'var(--font-display)',fontSize:17,color:'var(--azul)',fontWeight:700,marginBottom:12}}>📸 {modalPresenca.titulo}</div>
            <div className="alert alert-blue" style={{marginBottom:18}}>
              <span className="alert-icon">ℹ️</span>
              <div style={{fontSize:12.5}}>Informe quantas pessoas <strong>realmente compareceram</strong>. Isso pode ser diferente do planejado e será usado nos gráficos de métricas.</div>
            </div>
            <div style={{background:'var(--cinza-cl)',borderRadius:10,padding:'12px 14px',marginBottom:16}}>
              <div style={{fontSize:11.5,fontWeight:700,color:'var(--cinza-medio)',marginBottom:6}}>📋 Estimado no planejamento:</div>
              <div style={{display:'flex',gap:16,fontSize:14,fontWeight:700,color:'var(--azul)'}}>
                <span>👧 {modalPresenca.qtd_criancas||0} crianças</span>
                <span>👨 {modalPresenca.qtd_adultos||0} adultos</span>
                <span>Total: {(modalPresenca.qtd_criancas||0)+(modalPresenca.qtd_adultos||0)}</span>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">✅ Crianças que Compareceram</label>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={presencaForm.real_criancas} onChange={e=>setPresencaForm(f=>({...f,real_criancas:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">✅ Adultos que Compareceram</label>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={presencaForm.real_adultos} onChange={e=>setPresencaForm(f=>({...f,real_adultos:e.target.value}))}/>
              </div>
            </div>
            {(presencaForm.real_criancas||presencaForm.real_adultos)&&(
              <div className="alert alert-green">
                <span className="alert-icon">✅</span>
                <div style={{fontSize:12.5}}>
                  Total real: <strong>{(parseInt(presencaForm.real_criancas)||0)+(parseInt(presencaForm.real_adultos)||0)} pessoas</strong>
                  {' '} vs {(modalPresenca.qtd_criancas||0)+(modalPresenca.qtd_adultos||0)} estimadas
                  {' '}({(parseInt(presencaForm.real_criancas)||0)+(parseInt(presencaForm.real_adultos)||0)>=(modalPresenca.qtd_criancas||0)+(modalPresenca.qtd_adultos||0)?'🎉 superou a meta!':'📉 abaixo do estimado'})
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

function gerarHistoricoPDF(atividade, registros) {
  const fotos = registros.filter(r=>r.tipo==='foto')
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Histórico — ${atividade.titulo}</title>
  <style>body{font-family:Arial,sans-serif;padding:28px;color:#1e2a3a}.header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #c9a227}h1{font-size:20px;color:#1a3a6b;margin:4px 0}.info{background:#f2f5fb;padding:14px 18px;border-radius:10px;margin-bottom:20px;font-size:13px}.info table{width:100%}.info td{padding:4px 8px}.info td:first-child{font-weight:700;color:#1a3a6b;width:130px}.comparativo{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}.comp-box{padding:14px;border-radius:10px}.comp-estimado{background:#e8eef8}.comp-real{background:#eaf5ee}.comp-box h3{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}.comp-box .num{font-size:24px;font-weight:700}.fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.fotos img{width:100%;border-radius:6px;aspect-ratio:1;object-fit:cover}h2{font-size:15px;color:#1a3a6b;margin:20px 0 10px;border-bottom:1px solid #dce3f0;padding-bottom:6px}.footer{margin-top:28px;text-align:center;font-size:11px;color:#888;border-top:1px solid #dce3f0;padding-top:14px}@media print{button{display:none!important}}</style></head>
  <body>
  <div class="header"><div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase">Instituto Nossa Senhora Menina</div><h1>Histórico de Atividade</h1><div style="font-size:12px;color:#888;margin-top:4px">${atividade.titulo}</div></div>
  <div class="info"><table>
    <tr><td>Data</td><td>${atividade.data?new Date(atividade.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'—'}</td></tr>
    <tr><td>Local</td><td>${atividade.local||'—'}</td></tr>
    <tr><td>Tema</td><td>${atividade.tema||'—'}</td></tr>
  </table>${atividade.descricao?`<p style="margin-top:10px"><strong>Descrição:</strong> ${atividade.descricao}</p>`:''}${atividade.insumos?`<p style="margin-top:6px"><strong>Insumos:</strong> ${atividade.insumos}</p>`:''}</div>
  <div class="comparativo">
    <div class="comp-box comp-estimado"><h3>📋 Estimado</h3><div class="num" style="color:#1a3a6b">${(atividade.qtd_criancas||0)+(atividade.qtd_adultos||0)}</div><div style="font-size:12px;color:#555">👧 ${atividade.qtd_criancas||0} crianças · 👨 ${atividade.qtd_adultos||0} adultos</div></div>
    ${atividade.real_criancas!=null?`<div class="comp-box comp-real"><h3>✅ Presença Real</h3><div class="num" style="color:#2e7d52">${(atividade.real_criancas||0)+(atividade.real_adultos||0)}</div><div style="font-size:12px;color:#555">👧 ${atividade.real_criancas||0} crianças · 👨 ${atividade.real_adultos||0} adultos</div></div>`:'<div class="comp-box" style="background:#f4f6fb"><h3>✅ Presença Real</h3><div style="font-size:12px;color:#888">Não registrada</div></div>'}
  </div>
  ${fotos.length>0?`<h2>📷 Registros Fotográficos (${fotos.length})</h2><div class="fotos">${fotos.map(f=>`<img src="${f.arquivo_url}" alt="${f.nome}">`).join('')}</div>`:''}
  <div class="footer">✦ Instituto Nossa Senhora Menina · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir / Salvar PDF</button></div>
  </body></html>`
  const win=window.open('','_blank','width=900,height=700')
  win.document.write(html);win.document.close()
}
