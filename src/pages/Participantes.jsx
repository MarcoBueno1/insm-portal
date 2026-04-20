import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'

const TIPO_RESPONSAVEL = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tio(a)', 'Irmão/Irmã', 'Outro']
const TIPOS_PARTICIPANTE = ['crianca', 'adulto']

const EMPTY = {
  nome: '', tipo: 'crianca', data_nascimento: '', idade: '',
  endereco: '', bairro: '', cidade: '', cep: '',
  nome_responsavel: '', parentesco: 'Mãe', telefone_responsavel:
  '', email_responsavel: '', observacao: '',
}

function calcularIdade(dataNasc) {
  if (!dataNasc) return ''
  const hoje = new Date()
  const nasc = new Date(dataNasc + 'T12:00')
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

function Avatar({ nome, tipo, size = 38 }) {
  const ini = (nome || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const bg = tipo === 'crianca'
    ? 'linear-gradient(135deg,#2a5298,#4a7fcb)'
    : 'linear-gradient(135deg,#2e7d52,#52c27d)'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, background:bg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:size*.34 }}>
      {ini}
    </div>
  )
}

export default function Participantes() {
  const { isCoord, nomeUser, user } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [verModal, setVerModal] = useState(null)
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [tab, setTab] = useState('lista')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('participantes')
      .select('*')
      .order('nome')
    setLista(data || [])
    setLoading(false)
  }

  function abrirNovo() {
    setForm(EMPTY); setEditando(null); setModalOpen(true)
  }

  function abrirEditar(p) {
    setForm({
      nome: p.nome, tipo: p.tipo, data_nascimento: p.data_nascimento || '',
      idade: p.idade || '', endereco: p.endereco || '', bairro: p.bairro || '',
      cidade: p.cidade || '', cep: p.cep || '', nome_responsavel: p.nome_responsavel || '',
      parentesco: p.parentesco || 'Mãe', telefone_responsavel: p.telefone_responsavel || '',
      email_responsavel: p.email_responsavel || '', observacao: p.observacao || '',
    })
    setEditando(p.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { toast('Informe o nome.', 'error'); return }
    setSaving(true)
    const idade = form.data_nascimento ? calcularIdade(form.data_nascimento) : (parseInt(form.idade) || null)
    const payload = { ...form, idade, cadastrado_por: nomeUser, usuario_id: user?.id }
    let error
    if (editando) {
      ;({ error } = await supabase.from('participantes').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando))
    } else {
      ;({ error } = await supabase.from('participantes').insert(payload))
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Participante atualizado!' : '✅ Participante cadastrado!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function remover(id, nome) {
    if (!confirm(`Remover "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('participantes').delete().eq('id', id)
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast('Participante removido.'); load() }
  }

  const filtrados = lista.filter(p => {
    const mTipo = filtroTipo === 'todos' || p.tipo === filtroTipo
    const mBusca = !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.bairro || '').toLowerCase().includes(busca.toLowerCase()) ||
      (p.nome_responsavel || '').toLowerCase().includes(busca.toLowerCase())
    return mTipo && mBusca
  })

  const totalCriancas = lista.filter(p => p.tipo === 'crianca').length
  const totalAdultos  = lista.filter(p => p.tipo === 'adulto').length

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">👧 Participantes Cadastrados</h1>
          <p className="page-subtitle">Crianças e adultos do Instituto Nossa Senhora Menina</p>
        </div>
        <div className="page-actions">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar por nome, bairro..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          {isCoord && (
            <button className="btn btn-gold" onClick={abrirNovo}>+ Cadastrar</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        {[
          { ic:'👧', val:totalCriancas, lbl:'Crianças Cadastradas', cor:'var(--azul)', type:'blue' },
          { ic:'👨', val:totalAdultos,  lbl:'Adultos Cadastrados',  cor:'var(--verde)', type:'green' },
          { ic:'👥', val:lista.length,  lbl:'Total de Participantes', cor:'var(--laranja)', type:'orange' },
        ].map(s => (
          <div key={s.lbl} className={`stat-card ${s.type}`}>
            <span className="stat-icon">{s.ic}</span>
            <div className="stat-value" style={{ color: s.cor }}>{s.val}</div>
            <div className="stat-label">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Filtros */}
      <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <div className="tabs">
          <button className={`tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>📋 Lista</button>
          <button className={`tab ${tab === 'bairros' ? 'active' : ''}`} onClick={() => setTab('bairros')}>🗺️ Por Bairro</button>
        </div>
        <div className="tabs">
          {[['todos','Todos'], ['crianca','👧 Crianças'], ['adulto','👨 Adultos']].map(([v,l]) => (
            <button key={v} className={`tab ${filtroTipo === v ? 'active' : ''}`} onClick={() => setFiltroTipo(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* LISTA */}
      {tab === 'lista' && (
        loading ? <div className="loading-center"><div className="spinner" /></div>
        : filtrados.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">👧</span>
            <h3>Nenhum participante encontrado</h3>
            <p>{busca ? 'Tente outra busca.' : 'Cadastre o primeiro participante do Instituto.'}</p>
            {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>Cadastrar participante</button>}
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="hide-desktop" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtrados.map(p => (
                <div key={p.id} style={{ background:'white', borderRadius:12, padding:'14px 16px', border:'1px solid var(--borda)', boxShadow:'var(--shadow)' }}>
                  <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <Avatar nome={p.nome} tipo={p.tipo} size={42} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--azul)' }}>{p.nome}</div>
                      <div style={{ fontSize:12, color:'var(--cinza-medio)', marginTop:2 }}>
                        {p.tipo === 'crianca' ? `👧 ${p.idade || '?'} anos` : '👨 Adulto'}
                        {p.bairro && ` · 📍 ${p.bairro}`}
                      </div>
                      {p.nome_responsavel && (
                        <div style={{ fontSize:12, color:'var(--cinza)', marginTop:2 }}>
                          {p.parentesco}: {p.nome_responsavel}
                          {p.telefone_responsavel && ` · 📞 ${p.telefone_responsavel}`}
                        </div>
                      )}
                    </div>
                  </div>
                  {isCoord && (
                    <div style={{ display:'flex', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid var(--borda)' }}>
                      <button className="btn btn-sm btn-outline" style={{ flex:1, justifyContent:'center' }} onClick={() => setVerModal(p)}>👁 Ver</button>
                      <button className="btn btn-sm btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={() => abrirEditar(p)}>✏️ Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remover(p.id, p.nome)}>🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="card hide-mobile">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Tipo</th>
                      <th>Idade</th>
                      <th>Bairro</th>
                      <th>Responsável</th>
                      <th>Telefone</th>
                      <th>Cadastrado em</th>
                      {isCoord && <th style={{ textAlign:'center' }}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <Avatar nome={p.nome} tipo={p.tipo} size={32} />
                            <strong style={{ color:'var(--azul)' }}>{p.nome}</strong>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${p.tipo === 'crianca' ? 'badge-info' : 'badge-realizada'}`}>
                            {p.tipo === 'crianca' ? '👧 Criança' : '👨 Adulto'}
                          </span>
                        </td>
                        <td style={{ textAlign:'center', fontWeight:700 }}>
                          {p.idade ? `${p.idade} anos` : '—'}
                        </td>
                        <td>{p.bairro || '—'}</td>
                        <td>
                          {p.nome_responsavel ? (
                            <div>
                              <div style={{ fontSize:13, fontWeight:600 }}>{p.nome_responsavel}</div>
                              <div style={{ fontSize:11, color:'var(--cinza)' }}>{p.parentesco}</div>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize:13 }}>{p.telefone_responsavel || '—'}</td>
                        <td style={{ fontSize:12, color:'var(--cinza)', whiteSpace:'nowrap' }}>
                          {p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        {isCoord && (
                          <td>
                            <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                              <button className="btn btn-sm btn-outline" onClick={() => setVerModal(p)}>👁</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => abrirEditar(p)}>✏️</button>
                              <button className="btn btn-sm btn-danger" onClick={() => remover(p.id, p.nome)}>🗑</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* POR BAIRRO */}
      {tab === 'bairros' && (() => {
        const porBairro = {}
        filtrados.forEach(p => {
          const b = p.bairro || 'Não informado'
          if (!porBairro[b]) porBairro[b] = []
          porBairro[b].push(p)
        })
        const entradas = Object.entries(porBairro).sort((a, b) => b[1].length - a[1].length)
        const max = entradas[0]?.[1].length || 1
        return (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">🗺️ Participantes por Bairro</span></div>
              <div className="card-body">
                {entradas.map(([bairro, ps]) => (
                  <div key={bairro} className="bar-row">
                    <div className="bar-label"><span>{bairro}</span><span>{ps.length}</span></div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width:`${(ps.length/max)*100}%`, background:'linear-gradient(90deg,var(--azul),var(--azul-claro))' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {entradas.map(([bairro, ps]) => (
                <div key={bairro} className="card">
                  <div className="card-header">
                    <span className="card-title">📍 {bairro}</span>
                    <span className="badge badge-info">{ps.length} participante(s)</span>
                  </div>
                  <div className="card-body" style={{ padding:'12px 16px' }}>
                    {ps.slice(0, 5).map(p => (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <Avatar nome={p.nome} tipo={p.tipo} size={26} />
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--azul)' }}>{p.nome}</span>
                        <span style={{ fontSize:11, color:'var(--cinza)', marginLeft:'auto' }}>{p.idade ? `${p.idade}a` : ''}</span>
                      </div>
                    ))}
                    {ps.length > 5 && <div style={{ fontSize:12, color:'var(--cinza)', marginTop:4 }}>+{ps.length - 5} mais...</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Modal cadastro/edição ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Participante' : '👧 Cadastrar Participante'}
        size="lg"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </>}
      >
        {/* Tipo */}
        <div className="form-group">
          <label className="form-label">Tipo de Participante</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[['crianca','👧 Criança'], ['adulto','👨 Adulto']].map(([v, l]) => (
              <div
                key={v}
                onClick={() => setForm(f => ({ ...f, tipo: v }))}
                style={{ padding:'11px 14px', border:`2px solid ${form.tipo === v ? 'var(--azul-claro)' : 'var(--borda)'}`, borderRadius:10, cursor:'pointer', background: form.tipo === v ? 'var(--azul-suave)' : 'white', textAlign:'center', fontWeight:700, fontSize:14, color: form.tipo === v ? 'var(--azul)' : 'var(--cinza-medio)', transition:'all .15s' }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderBottom:'1px solid var(--borda)', paddingBottom:4, marginBottom:14, fontSize:11.5, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.8 }}>
          📋 Dados Pessoais
        </div>

        <div className="form-group">
          <label className="form-label">Nome Completo *</label>
          <input className="form-input" placeholder="Nome completo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Data de Nascimento</label>
            <input className="form-input" type="date"
              value={form.data_nascimento}
              onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value, idade: calcularIdade(e.target.value) || '' }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Idade {form.data_nascimento ? '(calculada)' : '(manual)'}</label>
            <input className="form-input" type="number" min="0" max="120" placeholder="Ex: 8"
              value={form.idade}
              onChange={e => setForm(f => ({ ...f, idade: e.target.value }))}
              readOnly={!!form.data_nascimento}
              style={form.data_nascimento ? { background:'var(--cinza-cl)', color:'var(--cinza-medio)' } : {}}
            />
          </div>
        </div>

        <div style={{ borderBottom:'1px solid var(--borda)', paddingBottom:4, marginBottom:14, marginTop:8, fontSize:11.5, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.8 }}>
          📍 Endereço
        </div>

        <div className="form-group">
          <label className="form-label">Endereço (rua e número)</label>
          <input className="form-input" placeholder="Ex: Rua das Flores, 123" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Bairro</label>
            <input className="form-input" placeholder="Ex: Centro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Cidade</label>
            <input className="form-input" placeholder="Ex: Manaus" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
          </div>
        </div>

        {form.tipo === 'crianca' && (
          <>
            <div style={{ borderBottom:'1px solid var(--borda)', paddingBottom:4, marginBottom:14, marginTop:8, fontSize:11.5, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.8 }}>
              👨‍👩‍👧 Responsável
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Nome do Responsável</label>
                <input className="form-input" placeholder="Nome completo" value={form.nome_responsavel} onChange={e => setForm(f => ({ ...f, nome_responsavel: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Parentesco</label>
                <select className="form-select" value={form.parentesco} onChange={e => setForm(f => ({ ...f, parentesco: e.target.value }))}>
                  {TIPO_RESPONSAVEL.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Telefone do Responsável</label>
                <input className="form-input" placeholder="(92) 99999-9999" value={form.telefone_responsavel} onChange={e => setForm(f => ({ ...f, telefone_responsavel: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail do Responsável</label>
                <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email_responsavel} onChange={e => setForm(f => ({ ...f, email_responsavel: e.target.value }))} />
              </div>
            </div>
          </>
        )}

        <div className="form-group" style={{ marginTop: 4 }}>
          <label className="form-label">Observações</label>
          <textarea className="form-textarea" rows="2" placeholder="Alergias, necessidades especiais, informações relevantes..." value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal visualizar ── */}
      <Modal
        open={!!verModal}
        onClose={() => setVerModal(null)}
        title={`👧 ${verModal?.nome || ''}`}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setVerModal(null)}>Fechar</button>
          {isCoord && <button className="btn btn-outline" onClick={() => { abrirEditar(verModal); setVerModal(null) }}>✏️ Editar</button>}
        </>}
      >
        {verModal && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', gap:16, alignItems:'center', padding:'14px 16px', background:'var(--creme)', borderRadius:12, border:'1px solid var(--borda)' }}>
              <Avatar nome={verModal.nome} tipo={verModal.tipo} size={56} />
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--azul)' }}>{verModal.nome}</div>
                <div style={{ fontSize:12.5, color:'var(--cinza-medio)', marginTop:3 }}>
                  {verModal.tipo === 'crianca' ? `👧 Criança · ${verModal.idade ? `${verModal.idade} anos` : 'Idade não informada'}` : '👨 Adulto'}
                </div>
                {verModal.data_nascimento && <div style={{ fontSize:12, color:'var(--cinza)' }}>🎂 {new Date(verModal.data_nascimento + 'T12:00').toLocaleDateString('pt-BR')}</div>}
              </div>
            </div>

            {(verModal.endereco || verModal.bairro) && (
              <div style={{ padding:'12px 14px', background:'var(--cinza-cl)', borderRadius:10 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>📍 Endereço</div>
                {verModal.endereco && <div style={{ fontSize:13, color:'var(--texto)' }}>{verModal.endereco}</div>}
                <div style={{ fontSize:13, color:'var(--cinza-medio)', marginTop:2 }}>
                  {[verModal.bairro, verModal.cidade].filter(Boolean).join(' · ')}
                </div>
              </div>
            )}

            {verModal.nome_responsavel && (
              <div style={{ padding:'12px 14px', background:'var(--cinza-cl)', borderRadius:10 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>👨‍👩‍👧 Responsável</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div><div style={{ fontSize:10.5, color:'var(--cinza)', fontWeight:700 }}>Nome</div><div style={{ fontSize:13, fontWeight:600 }}>{verModal.nome_responsavel}</div></div>
                  <div><div style={{ fontSize:10.5, color:'var(--cinza)', fontWeight:700 }}>Parentesco</div><div style={{ fontSize:13, fontWeight:600 }}>{verModal.parentesco}</div></div>
                  {verModal.telefone_responsavel && <div><div style={{ fontSize:10.5, color:'var(--cinza)', fontWeight:700 }}>Telefone</div><a href={`tel:${verModal.telefone_responsavel}`} style={{ fontSize:13, fontWeight:600, color:'var(--azul)', textDecoration:'none' }}>{verModal.telefone_responsavel}</a></div>}
                  {verModal.email_responsavel && <div><div style={{ fontSize:10.5, color:'var(--cinza)', fontWeight:700 }}>E-mail</div><div style={{ fontSize:12 }}>{verModal.email_responsavel}</div></div>}
                </div>
              </div>
            )}

            {verModal.observacao && (
              <div style={{ padding:'12px 14px', background:'var(--dourado-bg)', borderRadius:10, border:'1px solid rgba(201,162,39,.2)' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--dourado)', textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>📝 Observações</div>
                <div style={{ fontSize:13, color:'var(--texto)' }}>{verModal.observacao}</div>
              </div>
            )}

            <div style={{ fontSize:11, color:'var(--cinza)', textAlign:'right' }}>
              Cadastrado em {verModal.criado_em ? new Date(verModal.criado_em).toLocaleDateString('pt-BR') : '—'}
              {verModal.cadastrado_por && ` por ${verModal.cadastrado_por}`}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
