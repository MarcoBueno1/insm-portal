import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'

const PERFIS = [
  { v:'leitura', l:'👁️ Leitura',       desc:'Apenas visualiza — não cria, edita ou exclui nada.', cor:'var(--cinza)',    bg:'var(--cinza-cl)' },
  { v:'coord',   l:'✏️ Coordenador',   desc:'Visualiza e edita registros, atividades e estoque.', cor:'#7a5a00',         bg:'var(--dourado-bg)' },
  { v:'admin',   l:'⭐ Administrador', desc:'Acesso total, incluindo gestão de usuários.',         cor:'var(--azul)',     bg:'var(--azul-suave)' },
]

function PerfilChip({ perfil, selecionado, onClick, disabled }) {
  const p = PERFIS.find(x=>x.v===perfil)
  if (!p) return null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:'5px 11px', borderRadius:14,
        border:`1.5px solid ${selecionado?'var(--azul-claro)':'var(--borda)'}`,
        background:selecionado?p.bg:'white',
        color:selecionado?p.cor:'var(--cinza)',
        fontSize:12, fontWeight:700,
        cursor:disabled?'not-allowed':'pointer',
        transition:'all .15s',
        fontFamily:'var(--font-body)',
        opacity:disabled?.5:1,
      }}
    >{p.l}</button>
  )
}

export default function Usuarios() {
  const { isAdmin, user:authUser } = useAuth()
  const toast = useToast()
  const [aprovados,   setAprovados]   = useState([])
  const [perfisAtivos,setPerfisAtivos]= useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('aprovados')
  const [busca,       setBusca]       = useState('')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editandoId,  setEditandoId]  = useState(null)
  const [saving,      setSaving]      = useState(false)
  const EMPTY = { nome:'', email:'', perfil:'leitura' }
  const [form,        setForm]        = useState(EMPTY)

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  async function load() {
    setLoading(true)
    const [apRes, pfRes] = await Promise.all([
      supabase.from('usuarios_aprovados').select('*').order('nome'),
      supabase.from('perfis').select('*').order('nome'),
    ])
    setAprovados(apRes.data || [])
    setPerfisAtivos(pfRes.data || [])
    setLoading(false)
  }

  function abrirNovo()  { setForm(EMPTY); setEditandoId(null); setModalOpen(true) }
  function abrirEditar(a) { setForm({ nome:a.nome, email:a.email, perfil:a.perfil }); setEditandoId(a.id); setModalOpen(true) }

  async function salvar() {
    if (!form.nome.trim()) { toast('Informe o nome.','error'); return }
    if (!/\S+@\S+\.\S+/.test(form.email)) { toast('E-mail inválido.','error'); return }
    setSaving(true)

    if (editandoId) {
      // Editar
      const { error } = await supabase.from('usuarios_aprovados').update({ nome:form.nome.trim(), perfil:form.perfil }).eq('id', editandoId)
      // Atualiza perfil ativo se existir
      const pa = perfisAtivos.find(p=>p.email===aprovados.find(a=>a.id===editandoId)?.email)
      if (pa) await supabase.from('perfis').update({ perfil:form.perfil, nome:form.nome.trim() }).eq('id',pa.id)
      if (error) toast('Erro: '+error.message,'error')
      else { toast('Cadastro atualizado!'); setModalOpen(false); load() }
    } else {
      // Verificar duplicata
      if (aprovados.some(a=>a.email===form.email.toLowerCase().trim())) { toast('Este e-mail já está na lista.','warning'); setSaving(false); return }
      const { error } = await supabase.from('usuarios_aprovados').insert({ nome:form.nome.trim(), email:form.email.toLowerCase().trim(), perfil:form.perfil, ativo:true })
      if (error) toast('Erro: '+error.message,'error')
      else { toast('✅ Usuário pré-aprovado! Já pode criar a conta.'); setModalOpen(false); setForm(EMPTY); load() }
    }
    setSaving(false)
  }

  async function alterarPerfil(ap, novoPerfil) {
    if (ap.email===authUser?.email && novoPerfil!=='admin') { toast('Você não pode rebaixar seu próprio perfil.','error'); return }
    await supabase.from('usuarios_aprovados').update({ perfil:novoPerfil }).eq('id',ap.id)
    const pa = perfisAtivos.find(p=>p.email===ap.email)
    if (pa) await supabase.from('perfis').update({ perfil:novoPerfil }).eq('id',pa.id)
    toast('Perfil atualizado!')
    load()
  }

  async function toggleAtivo(ap) {
    if (ap.email===authUser?.email) { toast('Você não pode suspender seu próprio acesso.','error'); return }
    await supabase.from('usuarios_aprovados').update({ ativo:!ap.ativo }).eq('id',ap.id)
    toast(ap.ativo?'Acesso suspenso.':'Acesso reativado.')
    load()
  }

  async function remover(ap) {
    if (ap.email===authUser?.email) { toast('Você não pode remover seu próprio acesso.','error'); return }
    if (!confirm(`Remover "${ap.nome}" (${ap.email}) da lista de aprovados?`)) return
    await supabase.from('usuarios_aprovados').delete().eq('id',ap.id)
    toast('Usuário removido.'); load()
  }

  const filtrados = aprovados.filter(a =>
    !busca || a.nome.toLowerCase().includes(busca.toLowerCase()) || a.email.toLowerCase().includes(busca.toLowerCase())
  )

  const stats = {
    total:    aprovados.length,
    ativos:   aprovados.filter(a=>a.ativo).length,
    suspensos:aprovados.filter(a=>!a.ativo).length,
    admins:   aprovados.filter(a=>a.perfil==='admin').length,
    coords:   aprovados.filter(a=>a.perfil==='coord').length,
    cadastrados: perfisAtivos.length,
  }

  if (!isAdmin) return (
    <div className="empty-state" style={{ paddingTop:80 }}>
      <span className="empty-icon">🔒</span>
      <h3>Acesso Restrito</h3>
      <p>Apenas administradores podem gerenciar usuários.</p>
    </div>
  )

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔐 Usuários & Controle de Acesso</h1>
          <p className="page-subtitle">Pré-aprove e gerencie quem pode acessar o sistema</p>
        </div>
        <div className="page-actions">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar por nome ou e-mail..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          <button className="btn btn-gold" onClick={abrirNovo}>+ Pré-aprovar Pessoa</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:20 }}>
        {[
          {ic:'👥',v:stats.total,      l:'Total',       c:'var(--azul)'},
          {ic:'✅',v:stats.ativos,     l:'Ativos',      c:'var(--verde)'},
          {ic:'⏸',v:stats.suspensos,  l:'Suspensos',   c:'var(--laranja)'},
          {ic:'⭐',v:stats.admins,     l:'Admins',      c:'var(--azul)'},
          {ic:'✏️',v:stats.coords,     l:'Coords',      c:'#7a5a00'},
          {ic:'🔑',v:stats.cadastrados,l:'Cadastrados', c:'var(--verde)'},
        ].map(s=>(
          <div key={s.l} style={{ background:'white', borderRadius:11, padding:'12px 10px', border:'1px solid var(--borda)', boxShadow:'var(--shadow)', textAlign:'center' }}>
            <div style={{ fontSize:18, marginBottom:3 }}>{s.ic}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:s.c, lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:10, color:'var(--cinza)', fontWeight:700, textTransform:'uppercase', letterSpacing:.4, marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="alert alert-gold" style={{ marginBottom:18 }}>
        <span className="alert-icon">⭐</span>
        <div style={{ fontSize:12.5 }}>
          <strong>Como funciona:</strong> Cadastre o e-mail aqui → A pessoa acessa o site e cria a conta com <strong>Google</strong> ou <strong>e-mail+senha</strong> → O sistema libera automaticamente com o perfil definido.
          Você pode alterar o perfil e suspender o acesso a qualquer momento.
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:18 }}>
        <button className={`tab ${tab==='aprovados'?'active':''}`} onClick={()=>setTab('aprovados')}>
          📋 E-mails Aprovados ({aprovados.length})
        </button>
        <button className={`tab ${tab==='ativos'?'active':''}`} onClick={()=>setTab('ativos')}>
          👥 Já Cadastrados ({perfisAtivos.length})
        </button>
        <button className={`tab ${tab==='perfis'?'active':''}`} onClick={()=>setTab('perfis')}>
          🎭 Perfis
        </button>
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div> : (
        <>
          {/* ── ABA APROVADOS ── */}
          {tab==='aprovados' && (
            filtrados.length===0 ? (
              <div className="empty-state">
                <span className="empty-icon">📧</span>
                <h3>{busca?'Nenhum resultado':'Nenhuma pessoa aprovada'}</h3>
                <button className="btn btn-gold" onClick={abrirNovo}>Pré-aprovar primeiro usuário</button>
              </div>
            ) : (
              <>
                {/* MOBILE: cards */}
                <div className="hide-desktop" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {filtrados.map(ap=>{
                    const jaCadastrou = perfisAtivos.some(p=>p.email===ap.email)
                    const euMesmo = ap.email===authUser?.email
                    const pi = PERFIS.find(p=>p.v===ap.perfil)
                    return (
                      <div key={ap.id} style={{ background:'white', borderRadius:12, padding:'14px 16px', border:`1px solid ${euMesmo?'var(--azul-claro)':'var(--borda)'}`, boxShadow:'var(--shadow)', background:euMesmo?'var(--azul-suave)':'white' }}>
                        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${pi?.bg||'var(--cinza-cl)'},${pi?.bg||'var(--cinza-cl)'})`, border:`2px solid ${pi?.cor||'var(--borda)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:pi?.cor||'var(--cinza)', flexShrink:0 }}>
                            {ap.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:13.5, color:'var(--azul)' }}>{ap.nome}{euMesmo&&<span style={{ fontSize:9.5, background:'var(--azul)', color:'white', padding:'1px 6px', borderRadius:10, marginLeft:5, fontWeight:700 }}>Você</span>}</div>
                            <div style={{ fontSize:11.5, color:'var(--cinza)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ap.email}</div>
                          </div>
                          <span style={{ fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:20, background:ap.ativo?'var(--verde-bg)':'var(--laran-bg)', color:ap.ativo?'var(--verde)':'var(--laranja)' }}>{ap.ativo?'✅':'⏸'}</span>
                        </div>
                        {/* Perfil inline */}
                        <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
                          {PERFIS.map(p=><PerfilChip key={p.v} perfil={p.v} selecionado={ap.perfil===p.v} onClick={()=>ap.perfil!==p.v&&alterarPerfil(ap,p.v)} disabled={euMesmo&&p.v!=='admin'}/>)}
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <button className="btn btn-sm btn-outline" onClick={()=>abrirEditar(ap)}>✏️ Editar</button>
                          {!euMesmo&&<button className={`btn btn-sm ${ap.ativo?'btn-ghost':'btn-success'}`} onClick={()=>toggleAtivo(ap)}>{ap.ativo?'⏸ Suspender':'▶ Reativar'}</button>}
                          {!euMesmo&&<button className="btn btn-sm btn-danger" onClick={()=>remover(ap)}>🗑</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* DESKTOP: tabela */}
                <div className="card hide-mobile">
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Pessoa</th><th>E-mail</th><th>Perfil de Acesso</th>
                        <th style={{textAlign:'center'}}>Status</th>
                        <th style={{textAlign:'center'}}>Cadastrou?</th>
                        <th>Aprovado em</th>
                        <th style={{textAlign:'center'}}>Ações</th>
                      </tr></thead>
                      <tbody>
                        {filtrados.map(ap=>{
                          const jaCadastrou = perfisAtivos.some(p=>p.email===ap.email)
                          const euMesmo = ap.email===authUser?.email
                          return (
                            <tr key={ap.id} style={{ background:euMesmo?'var(--azul-suave)':'white', opacity:ap.ativo?1:.65 }}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                                  <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,var(--azul),var(--azul-claro))', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:11, flexShrink:0 }}>
                                    {ap.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight:700, fontSize:13 }}>{ap.nome}{euMesmo&&<span style={{ fontSize:9.5, background:'var(--azul)', color:'white', padding:'1px 6px', borderRadius:10, marginLeft:5 }}>Você</span>}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize:12.5, color:'var(--cinza-medio)' }}>{ap.email}</td>
                              <td>
                                <div style={{ display:'flex', gap:4 }}>
                                  {PERFIS.map(p=><PerfilChip key={p.v} perfil={p.v} selecionado={ap.perfil===p.v} onClick={()=>ap.perfil!==p.v&&alterarPerfil(ap,p.v)} disabled={euMesmo&&p.v!=='admin'}/>)}
                                </div>
                              </td>
                              <td style={{textAlign:'center'}}>
                                <span style={{ fontSize:11.5, fontWeight:800, padding:'3px 9px', borderRadius:20, background:ap.ativo?'var(--verde-bg)':'var(--laran-bg)', color:ap.ativo?'var(--verde)':'var(--laranja)' }}>
                                  {ap.ativo?'✅ Ativo':'⏸ Suspenso'}
                                </span>
                              </td>
                              <td style={{textAlign:'center'}}>
                                <span style={{ fontSize:11.5, fontWeight:800, padding:'3px 9px', borderRadius:20, background:jaCadastrou?'var(--verde-bg)':'var(--laran-bg)', color:jaCadastrou?'var(--verde)':'var(--laranja)' }}>
                                  {jaCadastrou?'✅ Sim':'⏳ Não'}
                                </span>
                              </td>
                              <td style={{ fontSize:12, color:'var(--cinza)', whiteSpace:'nowrap' }}>
                                {new Date(ap.criado_em).toLocaleDateString('pt-BR')}
                              </td>
                              <td>
                                <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                                  <button className="btn btn-sm btn-outline" onClick={()=>abrirEditar(ap)} title="Editar">✏️</button>
                                  {!euMesmo&&<button className={`btn btn-sm ${ap.ativo?'btn-ghost':'btn-success'}`} onClick={()=>toggleAtivo(ap)} title={ap.ativo?'Suspender':'Reativar'}>{ap.ativo?'⏸':'▶'}</button>}
                                  {!euMesmo&&<button className="btn btn-sm btn-danger" onClick={()=>remover(ap)} title="Remover">🗑</button>}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          )}

          {/* ── ABA JÁ CADASTRADOS ── */}
          {tab==='ativos' && (
            perfisAtivos.length===0 ? (
              <div className="empty-state"><span className="empty-icon">👥</span><h3>Nenhum usuário cadastrado ainda</h3><p>Aparecerão aqui após criarem conta no sistema.</p></div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {perfisAtivos.map(p=>{
                  const ap = aprovados.find(a=>a.email===p.email)
                  const euMesmo = p.email===authUser?.email
                  const pi = PERFIS.find(x=>x.v===(p.perfil||'leitura'))
                  return (
                    <div key={p.id} style={{ background:'white', borderRadius:14, padding:'18px 20px', border:'1px solid var(--borda)', boxShadow:'var(--shadow)', display:'flex', flexDirection:'column', gap:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:42, height:42, borderRadius:'50%', background:`linear-gradient(135deg,var(--azul),var(--azul-claro))`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:14, flexShrink:0 }}>
                          {(p.nome||p.email||'U').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:'var(--azul)' }}>{p.nome||'—'}{euMesmo&&<span style={{ fontSize:9.5, background:'var(--azul)', color:'white', padding:'1px 6px', borderRadius:10, marginLeft:5 }}>Você</span>}</div>
                          <div style={{ fontSize:11.5, color:'var(--cinza)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.email}</div>
                        </div>
                      </div>
                      <div style={{ background:pi?.bg||'var(--cinza-cl)', borderRadius:8, padding:'7px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:12.5, fontWeight:700, color:pi?.cor||'var(--cinza)' }}>{pi?.l}</span>
                        <span style={{ fontSize:11, color:'var(--cinza)' }}>Desde {p.criado_em?new Date(p.criado_em).toLocaleDateString('pt-BR'):'—'}</span>
                      </div>
                      {!euMesmo && ap && (
                        <div>
                          <div style={{ fontSize:10.5, fontWeight:800, color:'var(--cinza)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Alterar perfil</div>
                          <div style={{ display:'flex', gap:4 }}>
                            {PERFIS.map(pf=><PerfilChip key={pf.v} perfil={pf.v} selecionado={(p.perfil||'leitura')===pf.v} onClick={()=>p.perfil!==pf.v&&alterarPerfil(ap,pf.v)}/>)}
                          </div>
                        </div>
                      )}
                      {ap && !euMesmo && (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:8, borderTop:'1px solid var(--borda)' }}>
                          <span style={{ fontSize:11.5, fontWeight:800, padding:'3px 9px', borderRadius:20, background:ap.ativo?'var(--verde-bg)':'var(--laran-bg)', color:ap.ativo?'var(--verde)':'var(--laranja)' }}>{ap.ativo?'✅ Ativo':'⏸ Suspenso'}</span>
                          <button className={`btn btn-sm ${ap.ativo?'btn-ghost':'btn-success'}`} onClick={()=>toggleAtivo(ap)} style={{ fontSize:11.5 }}>{ap.ativo?'⏸ Suspender':'▶ Reativar'}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ── ABA PERFIS ── */}
          {tab==='perfis' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:18 }}>
              {PERFIS.map(p=>(
                <div key={p.v} style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow)', border:'1px solid var(--borda)' }}>
                  <div style={{ padding:'18px 20px', background:p.bg, borderBottom:`3px solid ${p.cor}` }}>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:p.cor, marginBottom:4 }}>{p.l}</div>
                    <p style={{ fontSize:12.5, color:p.cor, opacity:.85 }}>{p.desc}</p>
                    <div style={{ marginTop:8, fontSize:12, fontWeight:700, color:p.cor }}>{aprovados.filter(a=>a.perfil===p.v).length} pessoa(s)</div>
                  </div>
                  <div style={{ padding:'14px 20px' }}>
                    <div style={{ fontSize:10.5, fontWeight:800, color:'var(--cinza)', textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>Permissões</div>
                    {(p.v==='leitura'?['Ver todas as seções','Não pode criar ou editar']:p.v==='coord'?['Tudo de Leitura','Publicar no mural','Criar e editar atividades','Upload de fotos','Movimentar estoque','Registrar compras']:['Tudo de Coordenador','Pré-aprovar usuários','Suspender/reativar acessos','Alterar perfis','Remover usuários']).map(pm=>(
                      <div key={pm} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12.5, color:'var(--texto)', marginBottom:5 }}>
                        <span style={{ color:'var(--verde)', fontWeight:800, flexShrink:0 }}>✓</span><span>{pm}</span>
                      </div>
                    ))}
                  </div>
                  {aprovados.filter(a=>a.perfil===p.v).length>0&&(
                    <div style={{ padding:'10px 20px', borderTop:'1px solid var(--borda)', background:'var(--creme)' }}>
                      <div style={{ fontSize:10.5, fontWeight:800, color:'var(--cinza)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Pessoas</div>
                      {aprovados.filter(a=>a.perfil===p.v).map(a=>(
                        <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <div style={{ width:24, height:24, borderRadius:'50%', background:`linear-gradient(135deg,var(--azul),var(--azul-claro))`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:9, flexShrink:0 }}>
                            {a.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'var(--azul)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nome}</div>
                          </div>
                          {!a.ativo&&<span style={{ fontSize:10, background:'var(--laran-bg)', color:'var(--laranja)', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>⏸</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal pré-aprovar / editar */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)}
        title={editandoId?'✏️ Editar Cadastro':'✦ Pré-aprovar Acesso ao Sistema'}
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving?'⏳ Salvando...':editandoId?'Salvar Alterações':'✅ Pré-aprovar Acesso'}</button>
        </>}
      >
        {!editandoId && (
          <div className="alert alert-blue" style={{ marginBottom:16 }}>
            <span className="alert-icon">ℹ️</span>
            <div style={{ fontSize:12.5 }}>Após cadastrar, a pessoa poderá criar a conta com este e-mail via <strong>Google</strong> ou <strong>e-mail+senha</strong>.</div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Nome Completo *</label>
          <input className="form-input" placeholder="Ex: Irmã Maria das Graças" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} autoFocus/>
        </div>
        <div className="form-group">
          <label className="form-label">E-mail *</label>
          <input className="form-input" type="email" placeholder="usuario@email.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} readOnly={!!editandoId} style={editandoId?{background:'var(--cinza-cl)',color:'var(--cinza-medio)'}:{}}/>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ marginBottom:10 }}>Perfil de Acesso</label>
          {PERFIS.map(p=>(
            <div key={p.v} onClick={()=>setForm(f=>({...f,perfil:p.v}))}
              style={{ display:'flex', gap:10, padding:'11px 13px', borderRadius:9, border:`1.5px solid ${form.perfil===p.v?'var(--azul-claro)':'var(--borda)'}`, cursor:'pointer', background:form.perfil===p.v?p.bg:'white', marginBottom:7, transition:'all .15s' }}>
              <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${form.perfil===p.v?'var(--azul-medio)':'var(--borda)'}`, background:form.perfil===p.v?'var(--azul-medio)':'white', flexShrink:0, marginTop:2 }}/>
              <div>
                <div style={{ fontWeight:800, fontSize:13.5, color:'var(--azul)' }}>{p.l}</div>
                <div style={{ fontSize:12, color:'var(--cinza-medio)' }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
