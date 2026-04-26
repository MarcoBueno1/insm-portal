import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { registrarAuditoria } from '../lib/auditoria'
import { gerarRelatorioArrecadacaoPDF } from '../lib/pdf'

const STATUS_LIST = [
  { value:'planejada',    label:'📋 Planejada',    cor:'var(--azul)',    bg:'var(--azul-suave)' },
  { value:'em_andamento', label:'🔄 Em andamento', cor:'var(--laranja)', bg:'var(--laran-bg)'  },
  { value:'finalizada',   label:'✅ Finalizada',   cor:'var(--verde)',   bg:'var(--verde-bg)'  },
  { value:'cancelada',    label:'⚫ Cancelada',    cor:'var(--cinza)',   bg:'var(--cinza-cl)'  },
]

const FORM_VAZIO = {
  nome:'', detalhe:'', data_realizacao:'', status:'planejada',
  meta_valor:'', total_arrecadado:'', responsaveis:[], observacao:''
}

const fmt = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

export default function Arrecadacao() {
  const { user, nomeUser, isCoord } = useAuth()
  const toast = useToast()
  const [acoes, setAcoes]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(null)
  const [editando, setEditando]     = useState(null)
  const [form, setForm]             = useState(FORM_VAZIO)
  const [saving, setSaving]         = useState(false)
  const [novoResp, setNovoResp]     = useState('')
  const [filtroMes, setFiltroMes]   = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
  })
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [valorFinal, setValorFinal] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('arrecadacao')
      .select('*').order('data_realizacao', { ascending: true })
    setAcoes(data || [])
    setLoading(false)
  }

  function abrirNovo() { setEditando(null); setForm(FORM_VAZIO); setNovoResp(''); setModalOpen(true) }
  function abrirEditar(a) {
    setEditando(a)
    setForm({
      nome: a.nome, detalhe: a.detalhe||'', data_realizacao: a.data_realizacao||'',
      status: a.status, meta_valor: a.meta_valor||'',
      total_arrecadado: a.total_arrecadado||'',
      responsaveis: a.responsaveis||[], observacao: a.observacao||''
    })
    setNovoResp('')
    setModalOpen(true)
  }

  function addResp() {
    const r = novoResp.trim()
    if (!r || form.responsaveis.includes(r)) { setNovoResp(''); return }
    setForm(f => ({ ...f, responsaveis: [...f.responsaveis, r] }))
    setNovoResp('')
  }
  function remResp(r) { setForm(f => ({ ...f, responsaveis: f.responsaveis.filter(x => x !== r) })) }

  async function salvar() {
    if (!form.nome.trim()) { toast('Informe o nome da ação.', 'error'); return }
    setSaving(true)
    const payload = {
      nome: form.nome.trim(), detalhe: form.detalhe.trim(),
      data_realizacao: form.data_realizacao || null,
      status: form.status,
      meta_valor: form.meta_valor ? parseFloat(String(form.meta_valor).replace(',','.')) : null,
      total_arrecadado: form.total_arrecadado ? parseFloat(String(form.total_arrecadado).replace(',','.')) : null,
      responsaveis: form.responsaveis,
      observacao: form.observacao,
      criado_por: user.id, criado_por_nome: nomeUser,
    }

    if (editando) {
      const { error } = await supabase.from('arrecadacao').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando.id)
      if (error) { toast('Erro: '+error.message,'error'); setSaving(false); return }
      await registrarAuditoria({ tabela:'arrecadacao', registro_id:editando.id, acao:'editar',
        descricao: 'Ação "'+payload.nome+'" editada',
        valor_anterior:{ nome:editando.nome, status:editando.status },
        valor_novo:{ nome:payload.nome, status:payload.status },
        usuario_id:user.id, usuario_nome:nomeUser })
      toast('Ação atualizada!')
    } else {
      const { data, error } = await supabase.from('arrecadacao').insert(payload).select().single()
      if (error) { toast('Erro: '+error.message,'error'); setSaving(false); return }
      await registrarAuditoria({ tabela:'arrecadacao', registro_id:data?.id, acao:'criar',
        descricao: 'Ação "'+payload.nome+'" criada', valor_novo:payload,
        usuario_id:user.id, usuario_nome:nomeUser })
      toast('Ação cadastrada!')
    }
    setModalOpen(false); load()
    setSaving(false)
  }

  async function remover(a) {
    if (!confirm('Excluir a ação "'+a.nome+'"?')) return
    await supabase.from('arrecadacao').delete().eq('id', a.id)
    await registrarAuditoria({ tabela:'arrecadacao', registro_id:a.id, acao:'remover',
      descricao:'Ação "'+a.nome+'" removida', valor_anterior:{ nome:a.nome },
      usuario_id:user.id, usuario_nome:nomeUser })
    toast('Ação removida.'); load()
  }

  async function finalizar(acao) {
    const valor = parseFloat(String(valorFinal).replace(',','.'))
    if (!valorFinal || isNaN(valor)) { toast('Informe o valor arrecadado.','error'); return }
    setSaving(true)
    // 1. Atualiza ação
    await supabase.from('arrecadacao').update({
      status: 'finalizada', total_arrecadado: valor, atualizado_em: new Date().toISOString()
    }).eq('id', acao.id)

    // 2. Cria entrada em contas a receber (financeiro) como já recebida
    await supabase.from('financeiro').insert({
      tipo: 'receber',
      descricao: 'Arrecadação: ' + acao.nome,
      valor: valor,
      categoria: 'Arrecadação',
      favorecido: 'Instituto',
      data_vencimento: acao.data_realizacao || new Date().toISOString().split('T')[0],
      data_pagamento: new Date().toISOString().split('T')[0],
      status: 'pago',
      observacao: acao.detalhe || '',
      criado_por: user.id, criado_por_nome: nomeUser,
    })

    await registrarAuditoria({ tabela:'arrecadacao', registro_id:acao.id, acao:'editar',
      descricao:'Ação "'+acao.nome+'" finalizada — '+fmt(valor)+' arrecadados',
      valor_anterior:{ status:acao.status, total_arrecadado:acao.total_arrecadado },
      valor_novo:{ status:'finalizada', total_arrecadado:valor },
      usuario_id:user.id, usuario_nome:nomeUser })

    toast('✅ Ação finalizada! Entrada de '+fmt(valor)+' registrada em Contas a Receber.')
    setModalFinalizar(null); setValorFinal(''); setSaving(false); load()
  }

  // Filtragem
  const filtrados = useMemo(() => {
    return acoes.filter(a => {
      if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false
      if (filtroMes && a.data_realizacao) {
        const ym = a.data_realizacao.slice(0,7)
        if (ym !== filtroMes) return false
      }
      return true
    })
  }, [acoes, filtroStatus, filtroMes])

  const metricas = useMemo(() => {
    const [ano, mes] = filtroMes.split('-').map(Number)
    const doMes = acoes.filter(a => {
      if (!a.data_realizacao) return false
      const d = new Date(a.data_realizacao+'T00:00:00')
      return d.getFullYear()===ano && d.getMonth()+1===mes
    })
    return {
      total: doMes.length,
      finalizadas: doMes.filter(a=>a.status==='finalizada').length,
      emAndamento: doMes.filter(a=>a.status==='em_andamento').length,
      meta: doMes.reduce((s,a)=>s+Number(a.meta_valor||0),0),
      arrecadado: doMes.reduce((s,a)=>s+Number(a.total_arrecadado||0),0),
    }
  }, [acoes, filtroMes])

  const nomeMes = new Date(filtroMes+'-01').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Planejamento de Arrecadação</h1>
          <p className="page-subtitle">Organize e acompanhe as ações de captação de recursos do Instituto</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => gerarRelatorioArrecadacaoPDF(filtrados, nomeMes)}>📄 PDF</button>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>+ Nova Ação</button>}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:11,fontWeight:700,color:'var(--azul)',textTransform:'uppercase',letterSpacing:.7,display:'block',marginBottom:4 }}>Mês</label>
          <input type="month" className="form-input" style={{ width:'auto' }}
            value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:11,fontWeight:700,color:'var(--azul)',textTransform:'uppercase',letterSpacing:.7,display:'block',marginBottom:4 }}>Status</label>
          <select className="form-select" style={{ width:'auto' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos</option>
            {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Cards de métricas do mês */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Ações no mês',   val:metricas.total,       icon:'🎯', cor:'var(--azul)',    isN:true },
          { label:'Finalizadas',    val:metricas.finalizadas,  icon:'✅', cor:'var(--verde)',   isN:true },
          { label:'Em andamento',   val:metricas.emAndamento,  icon:'🔄', cor:'var(--laranja)', isN:true },
          { label:'Meta total',     val:metricas.meta,         icon:'🏆', cor:'var(--dourado)', isN:false },
          { label:'Arrecadado',     val:metricas.arrecadado,   icon:'💰', cor:'var(--verde)',   isN:false },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <div style={{ fontSize: c.isN?28:17, fontWeight:800, color:c.cor, fontFamily:'var(--font-display)', lineHeight:1 }}>
              {c.isN ? c.val : fmt(c.val)}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--cinza)', textTransform:'uppercase', letterSpacing:.5, marginTop:4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Barra de progresso meta vs arrecadado */}
      {metricas.meta > 0 && (
        <div className="card" style={{ padding:'16px 22px', marginBottom:22 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontWeight:700, fontSize:13, color:'var(--azul)' }}>📊 Progresso de arrecadação — {nomeMes}</span>
            <span style={{ fontWeight:800, fontSize:14, color: metricas.arrecadado >= metricas.meta ? 'var(--verde)' : 'var(--laranja)' }}>
              {fmt(metricas.arrecadado)} / {fmt(metricas.meta)} ({Math.round(metricas.arrecadado/metricas.meta*100)}%)
            </span>
          </div>
          <div style={{ height:14, background:'var(--borda)', borderRadius:7 }}>
            <div style={{
              height:'100%', borderRadius:7, transition:'width .5s',
              width: Math.min(100, Math.round(metricas.arrecadado/metricas.meta*100))+'%',
              background: metricas.arrecadado >= metricas.meta
                ? 'linear-gradient(90deg,var(--verde),#27ae60)'
                : 'linear-gradient(90deg,var(--dourado),var(--dourado-cl))'
            }} />
          </div>
        </div>
      )}

      {/* Lista de ações */}
      {loading ? (
        <div className="loading-center"><div className="spinner"/></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🎯</span>
          <h3>Nenhuma ação encontrada</h3>
          <p>Cadastre ações de arrecadação para este mês.</p>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>+ Nova Ação</button>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtrados.map(a => {
            const st = STATUS_LIST.find(s => s.value === a.status) || STATUS_LIST[0]
            return (
              <div key={a.id} className="card" style={{ padding:'18px 22px', border:'1px solid var(--borda)', borderLeft:'4px solid '+st.cor }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <h3 style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--azul)', margin:0 }}>{a.nome}</h3>
                      <span style={{ background:st.bg, color:st.cor, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:800 }}>{st.label}</span>
                    </div>
                    {a.detalhe && <p style={{ fontSize:13, color:'var(--cinza-medio)', margin:'0 0 8px' }}>{a.detalhe}</p>}
                    <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'var(--cinza)' }}>
                      {a.data_realizacao && (
                        <span>📅 {new Date(a.data_realizacao+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</span>
                      )}
                      {a.meta_valor && <span>🏆 Meta: <strong style={{ color:'var(--dourado)' }}>{fmt(a.meta_valor)}</strong></span>}
                      {a.total_arrecadado ? <span>💰 Arrecadado: <strong style={{ color:'var(--verde)' }}>{fmt(a.total_arrecadado)}</strong></span> : null}
                    </div>
                    {(a.responsaveis||[]).length > 0 && (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                        {a.responsaveis.map(r => (
                          <span key={r} style={{ background:'var(--azul-suave)', color:'var(--azul-medio)', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                            👤 {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isCoord && (
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {(a.status === 'em_andamento' || a.status === 'planejada') && (
                        <button className="btn btn-sm btn-success" title="Finalizar e registrar arrecadação"
                          onClick={() => { setModalFinalizar(a); setValorFinal(a.total_arrecadado||'') }}>
                          ✅ Finalizar
                        </button>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => abrirEditar(a)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remover(a)}>🗑</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal novo/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Ação' : '🎯 Nova Ação de Arrecadação'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Nome da Ação *</label>
          <input className="form-input" placeholder="Ex: Bazar Beneficente, Jantar Solidário..."
            value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Detalhes</label>
          <textarea className="form-textarea" rows="3" placeholder="Descreva como a ação será realizada, local, público-alvo..."
            value={form.detalhe} onChange={e => setForm(f=>({...f,detalhe:e.target.value}))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Data de Realização</label>
            <input type="date" className="form-input"
              value={form.data_realizacao} onChange={e => setForm(f=>({...f,data_realizacao:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
              {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Meta de Arrecadação (R$)</label>
            <input type="number" min="0" step="0.01" className="form-input" placeholder="0,00"
              value={form.meta_valor} onChange={e => setForm(f=>({...f,meta_valor:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Total Arrecadado (R$)</label>
            <input type="number" min="0" step="0.01" className="form-input" placeholder="Preencher ao finalizar"
              value={form.total_arrecadado} onChange={e => setForm(f=>({...f,total_arrecadado:e.target.value}))} />
          </div>
        </div>

        {/* Responsáveis */}
        <div className="form-group">
          <label className="form-label">Responsáveis</label>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input className="form-input" placeholder="Nome do responsável..."
              value={novoResp} onChange={e => setNovoResp(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addResp()} />
            <button type="button" className="btn btn-outline btn-sm" onClick={addResp}>+ Add</button>
          </div>
          {form.responsaveis.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {form.responsaveis.map(r => (
                <span key={r} style={{ background:'var(--azul-suave)', color:'var(--azul)', padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                  👤 {r}
                  <button onClick={() => remResp(r)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--vermelho)',fontWeight:800,fontSize:13,lineHeight:1,padding:0 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input className="form-input" placeholder="Observações adicionais..."
            value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))} />
        </div>
      </Modal>

      {/* Modal finalizar */}
      <Modal open={!!modalFinalizar} onClose={() => { setModalFinalizar(null); setValorFinal('') }}
        title={'✅ Finalizar — '+modalFinalizar?.nome}
        footer={<>
          <button className="btn btn-ghost" onClick={() => { setModalFinalizar(null); setValorFinal('') }}>Cancelar</button>
          <button className="btn btn-success" onClick={() => finalizar(modalFinalizar)} disabled={saving}>
            {saving ? '⏳...' : '✅ Confirmar e registrar entrada'}
          </button>
        </>}>
        {modalFinalizar && (
          <>
            <div className="alert alert-blue" style={{ marginBottom:16 }}>
              <span className="alert-icon">ℹ️</span>
              <div>
                Ao finalizar, o valor arrecadado será automaticamente registrado como uma
                <strong> entrada em Contas a Receber</strong> (status: recebido).
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Total Arrecadado (R$) *</label>
              <input type="number" min="0" step="0.01" className="form-input"
                placeholder="Ex: 1500,00" autoFocus
                value={valorFinal} onChange={e => setValorFinal(e.target.value)} />
            </div>
            {valorFinal && (
              <div className="alert alert-gold">
                <span className="alert-icon">💰</span>
                <div>
                  Será criado em <strong>Financeiro → Contas a Receber</strong>:<br/>
                  <strong>Arrecadação: {modalFinalizar.nome}</strong> — {fmt(parseFloat(valorFinal)||0)} (Recebido)
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
