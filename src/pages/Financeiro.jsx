import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { registrarAuditoria } from '../lib/auditoria'
import { gerarRelatorioFinanceiroPDF } from '../lib/pdf'

const TIPOS = [
  { value:'receber', label:'💚 A Receber', icon:'💚', cor:'var(--verde)',   bg:'var(--verde-bg)' },
  { value:'pagar',   label:'🔴 A Pagar',   icon:'🔴', cor:'var(--vermelho)',bg:'var(--vermelho-bg)' },
]
const STATUS = [
  { value:'pendente',  label:'⏳ Pendente',      cor:'var(--laranja)', bg:'var(--laran-bg)' },
  { value:'pago',      label:'✅ Pago/Recebido', cor:'var(--verde)',   bg:'var(--verde-bg)' },
  { value:'vencido',   label:'🔴 Vencido',       cor:'var(--vermelho)',bg:'var(--vermelho-bg)' },
  { value:'cancelado', label:'⚫ Cancelado',     cor:'var(--cinza)',   bg:'var(--cinza-cl)' },
]
const CAT_PAGAR   = ['Aluguel','Água','Luz','Internet','Material Escolar','Alimentação','Transporte','Salários','Impostos','Outros']
const CAT_RECEBER = ['Doações','Mensalidades','Arrecadação','Eventos','Patrocínios','Subvenções','Outros']

const FORM_VAZIO = { tipo:'pagar', descricao:'', valor:'', categoria:'', data_vencimento:'', data_pagamento:'', status:'pendente', observacao:'', favorecido:'' }
const fmt = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const hoje = () => new Date().toISOString().split('T')[0]

export default function Financeiro() {
  const { user, nomeUser, isCoord } = useAuth()
  const toast = useToast()
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading]         = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editando, setEditando]       = useState(null)
  const [form, setForm]               = useState(FORM_VAZIO)
  const [saving, setSaving]           = useState(false)
  const [aba, setAba]                 = useState('dashboard') // dashboard | pagar | receber | relatorio
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroMes, setFiltroMes]     = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('financeiro').select('*').order('data_vencimento', { ascending:false })
    setLancamentos(data||[])
    setLoading(false)
  }

  function abrirNovo(tipo='pagar') {
    setEditando(null)
    setForm({ ...FORM_VAZIO, tipo })
    setModalOpen(true)
  }

  function abrirEditar(l) {
    setEditando(l)
    setForm({ tipo:l.tipo, descricao:l.descricao, valor:l.valor, categoria:l.categoria||'',
      data_vencimento:l.data_vencimento||'', data_pagamento:l.data_pagamento||'',
      status:l.status, observacao:l.observacao||'', favorecido:l.favorecido||'' })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.descricao.trim()||!form.valor||!form.data_vencimento) {
      toast('Preencha descrição, valor e vencimento.','error'); return
    }
    setSaving(true)
    const payload = { tipo:form.tipo, descricao:form.descricao,
      valor: parseFloat(String(form.valor).replace(',','.')),
      categoria:form.categoria, data_vencimento:form.data_vencimento,
      data_pagamento:form.data_pagamento||null, status:form.status,
      observacao:form.observacao, favorecido:form.favorecido,
      criado_por:user.id, criado_por_nome:nomeUser }

    if (editando) {
      const { error } = await supabase.from('financeiro').update({ ...payload, atualizado_em:new Date().toISOString() }).eq('id', editando.id)
      if (error) { toast('Erro: '+error.message,'error'); setSaving(false); return }
      await registrarAuditoria({ tabela:'financeiro', registro_id:editando.id, acao:'editar',
        descricao:'Lançamento "'+form.descricao+'" editado',
        valor_anterior:{ descricao:editando.descricao, valor:editando.valor, status:editando.status },
        valor_novo:{ descricao:form.descricao, valor:payload.valor, status:form.status },
        usuario_id:user.id, usuario_nome:nomeUser })
      toast('Lançamento atualizado!')
    } else {
      const { data, error } = await supabase.from('financeiro').insert(payload).select().single()
      if (error) { toast('Erro: '+error.message,'error'); setSaving(false); return }
      await registrarAuditoria({ tabela:'financeiro', registro_id:data?.id, acao:'criar',
        descricao:'Lançamento "'+form.descricao+'" criado ('+form.tipo+')',
        valor_novo:payload, usuario_id:user.id, usuario_nome:nomeUser })
      toast('Lançamento criado!')
    }
    setModalOpen(false); load(); setSaving(false)
  }

  async function remover(l) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('financeiro').delete().eq('id',l.id)
    await registrarAuditoria({ tabela:'financeiro', registro_id:l.id, acao:'remover',
      descricao:'Lançamento "'+l.descricao+'" removido',
      valor_anterior:{ descricao:l.descricao, valor:l.valor },
      usuario_id:user.id, usuario_nome:nomeUser })
    toast('Removido.'); load()
  }

  async function marcarPago(l) {
    const novoStatus = l.status==='pago' ? 'pendente' : 'pago'
    await supabase.from('financeiro').update({ status:novoStatus,
      data_pagamento: novoStatus==='pago' ? hoje() : null }).eq('id',l.id)
    toast(novoStatus==='pago' ? '✅ Marcado como pago!' : '⏳ Voltou para pendente')
    load()
  }

  // ── Métricas do mês ─────────────────────────────────────────
  const metricas = useMemo(() => {
    const [ano,mes] = filtroMes.split('-').map(Number)
    const doMes = lancamentos.filter(l => {
      if (!l.data_vencimento) return false
      const d = new Date(l.data_vencimento+'T00:00:00')
      return d.getFullYear()===ano && d.getMonth()+1===mes
    })
    const totRec  = doMes.filter(l=>l.tipo==='receber').reduce((s,l)=>s+Number(l.valor||0),0)
    const totPag  = doMes.filter(l=>l.tipo==='pagar').reduce((s,l)=>s+Number(l.valor||0),0)
    const recebido= doMes.filter(l=>l.tipo==='receber'&&l.status==='pago').reduce((s,l)=>s+Number(l.valor||0),0)
    const pago    = doMes.filter(l=>l.tipo==='pagar'&&l.status==='pago').reduce((s,l)=>s+Number(l.valor||0),0)
    const vencidos= lancamentos.filter(l=>l.status!=='pago'&&l.status!=='cancelado'&&l.data_vencimento&&new Date(l.data_vencimento+'T23:59:59')<new Date())
    const saldo   = totRec - totPag

    // despesas por categoria
    const porCat = {}
    doMes.filter(l=>l.tipo==='pagar').forEach(l => { const c=l.categoria||'Outros'; porCat[c]=(porCat[c]||0)+Number(l.valor||0) })

    // evolução 6 meses
    const ultimos6 = []
    for (let i=5;i>=0;i--) {
      const d=new Date(); d.setMonth(d.getMonth()-i)
      const a=d.getFullYear(), m=d.getMonth()+1
      const dp=lancamentos.filter(l=>{
        if(!l.data_vencimento)return false
        const dv=new Date(l.data_vencimento+'T00:00:00')
        return dv.getFullYear()===a && dv.getMonth()+1===m
      })
      ultimos6.push({
        label: d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),
        rec: dp.filter(l=>l.tipo==='receber').reduce((s,l)=>s+Number(l.valor||0),0),
        pag: dp.filter(l=>l.tipo==='pagar').reduce((s,l)=>s+Number(l.valor||0),0),
      })
    }
    return { totRec,totPag,recebido,pago,vencidos,saldo,porCat,ultimos6,doMes }
  }, [lancamentos,filtroMes])

  // ── Listas filtradas ─────────────────────────────────────────
  const listaPagar   = lancamentos.filter(l => l.tipo==='pagar'   && (filtroStatus==='todos'||l.status===filtroStatus))
  const listaReceber = lancamentos.filter(l => l.tipo==='receber' && (filtroStatus==='todos'||l.status===filtroStatus))

  const maxBar = Math.max(...metricas.ultimos6.map(m=>Math.max(m.rec,m.pag)),1)
  const catEntradas = Object.entries(metricas.porCat).sort((a,b)=>b[1]-a[1])
  const maxCat = catEntradas[0]?.[1]||1

  // ── Tabela de lançamentos ────────────────────────────────────
  const TabelaLanc = ({ lista, tipo }) => {
    const t = TIPOS.find(x=>x.value===tipo)
    const totalLista = lista.reduce((s,l)=>s+Number(l.valor||0),0)
    if (lista.length===0) return (
      <div className="empty-state">
        <span className="empty-icon">{tipo==='receber'?'💚':'🔴'}</span>
        <h3>Nenhum lançamento</h3>
        {isCoord && <button className="btn btn-gold" onClick={()=>abrirNovo(tipo)}>+ Novo lançamento</button>}
      </div>
    )
    return (
      <div className="card" style={{ overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--azul)', color:'white' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:700 }}>Descrição</th>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:700 }}>Categoria</th>
              <th style={{ padding:'10px 14px', textAlign:'right', fontSize:12, fontWeight:700 }}>Valor</th>
              <th style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:700 }}>Vencimento</th>
              <th style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:700 }}>Status</th>
              {isCoord && <th style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:700 }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((l,i) => {
              const stat = STATUS.find(s=>s.value===l.status)||STATUS[0]
              const vencido = l.status!=='pago'&&l.status!=='cancelado'&&l.data_vencimento&&new Date(l.data_vencimento+'T23:59:59')<new Date()
              return (
                <tr key={l.id} style={{ borderBottom:'1px solid var(--borda)', background:vencido?'#fff5f5':i%2===0?'white':'var(--creme)' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600, fontSize:13 }}>
                    {l.descricao}
                    {l.favorecido && <div style={{ fontSize:11, color:'var(--cinza)' }}>→ {l.favorecido}</div>}
                    {l.observacao && <div style={{ fontSize:11, color:'var(--cinza)', fontStyle:'italic' }}>{l.observacao}</div>}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--cinza-medio)' }}>{l.categoria||'—'}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, fontSize:14, color:t?.cor }}>{fmt(l.valor)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'center', fontSize:12, color:vencido?'var(--vermelho)':'var(--texto)' }}>
                    {l.data_vencimento ? new Date(l.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    {vencido && <div style={{ fontSize:10, fontWeight:700, color:'var(--vermelho)' }}>VENCIDO</div>}
                  </td>
                  <td style={{ padding:'10px 14px', textAlign:'center' }}>
                    <span style={{ background:stat.bg, color:stat.cor, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:800 }}>{stat.label}</span>
                  </td>
                  {isCoord && (
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>
                      <div style={{ display:'flex', gap:5, justifyContent:'center' }}>
                        <button className="btn btn-sm btn-success" title={l.status==='pago'?'Desfazer pagamento':'Marcar como pago'}
                          onClick={()=>marcarPago(l)} style={{ padding:'4px 8px', fontSize:12 }}>
                          {l.status==='pago'?'↩️':'✅'}
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={()=>abrirEditar(l)} style={{ padding:'4px 8px', fontSize:12 }}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>remover(l)} style={{ padding:'4px 8px', fontSize:12 }}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:'var(--azul-suave)' }}>
              <td colSpan={2} style={{ padding:'10px 14px', fontSize:13, color:'var(--azul)', fontWeight:700 }}>
                TOTAL ({lista.length} lançamentos)
              </td>
              <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, fontSize:15, color:t?.cor }}>{fmt(totalLista)}</td>
              <td colSpan={isCoord?3:2} />
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  const nomeMes = new Date(filtroMes+'-01').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 Financeiro</h1>
          <p className="page-subtitle">Controle completo de contas a pagar e a receber</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => gerarRelatorioFinanceiroPDF(
            lancamentos.filter(l=>{
              if(!l.data_vencimento)return false
              const [a,m]=filtroMes.split('-').map(Number)
              const d=new Date(l.data_vencimento+'T00:00:00')
              return d.getFullYear()===a&&d.getMonth()+1===m
            }), nomeMes)}>📄 PDF do mês</button>
          {isCoord && (
            <>
              <button className="btn btn-danger btn-sm" onClick={()=>abrirNovo('pagar')}>+ A Pagar</button>
              <button className="btn btn-success btn-sm" onClick={()=>abrirNovo('receber')}>+ A Receber</button>
            </>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="tabs" style={{ marginBottom:22 }}>
        {[['dashboard','📊 Dashboard'],['receber','💚 A Receber'],['pagar','🔴 A Pagar'],['relatorio','📄 Relatório']].map(([v,l])=>(
          <button key={v} className={'tab '+(aba===v?'active':'')} onClick={()=>setAba(v)}>{l}</button>
        ))}
      </div>

      {/* ═════════ DASHBOARD ═════════ */}
      {aba==='dashboard' && (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
            <label style={{ fontWeight:700, color:'var(--azul)', fontSize:13 }}>📅 Mês:</label>
            <input type="month" className="form-input" style={{ width:'auto' }}
              value={filtroMes} onChange={e=>setFiltroMes(e.target.value)} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:14, marginBottom:24 }}>
            {[
              { label:'A Receber', val:metricas.totRec, sub:fmt(metricas.recebido)+' recebido', icon:'💚', cor:'var(--verde)', bg:'var(--verde-bg)' },
              { label:'A Pagar',   val:metricas.totPag, sub:fmt(metricas.pago)+' pago',          icon:'🔴', cor:'var(--vermelho)', bg:'var(--vermelho-bg)' },
              { label:'Saldo do Mês', val:metricas.saldo, sub:metricas.saldo>=0?'Positivo ✓':'Negativo ⚠️', icon:'⚖️',
                cor:metricas.saldo>=0?'var(--verde)':'var(--vermelho)', bg:metricas.saldo>=0?'var(--verde-bg)':'var(--vermelho-bg)' },
              { label:'Vencidos', val:metricas.vencidos.length, sub:'em aberto', icon:'⚠️', cor:'var(--laranja)', bg:'var(--laran-bg)', isN:true },
            ].map(c=>(
              <div key={c.label} className="card" style={{ padding:'16px 20px', background:c.bg, border:'1px solid '+c.cor+'33' }}>
                <div style={{ fontSize:24, marginBottom:4 }}>{c.icon}</div>
                <div style={{ fontSize:c.isN?28:18, fontWeight:800, color:c.cor, fontFamily:'var(--font-display)', lineHeight:1 }}>
                  {c.isN ? c.val : fmt(c.val)}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--cinza-medio)', textTransform:'uppercase', letterSpacing:.5 }}>{c.label}</div>
                <div style={{ fontSize:11, color:'var(--cinza)', marginTop:3 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:24 }}>
            {/* Evolução */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--azul)', marginBottom:16, fontSize:15 }}>📈 Evolução — últimos 6 meses</h3>
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160 }}>
                {metricas.ultimos6.map((m,i)=>(
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{ display:'flex', gap:3, alignItems:'flex-end', height:130 }}>
                      <div title={'A receber: '+fmt(m.rec)} style={{ width:14, height:Math.max(3,m.rec/maxBar*120)+'px', background:'var(--verde)', borderRadius:'3px 3px 0 0', transition:'height .4s' }}/>
                      <div title={'A pagar: '+fmt(m.pag)}   style={{ width:14, height:Math.max(3,m.pag/maxBar*120)+'px', background:'var(--vermelho)', borderRadius:'3px 3px 0 0', transition:'height .4s' }}/>
                    </div>
                    <span style={{ fontSize:9, color:'var(--cinza)', fontWeight:700 }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:14, marginTop:10 }}>
                <span style={{ fontSize:11, display:'flex', alignItems:'center', gap:5 }}><span style={{ width:10,height:10,background:'var(--verde)',borderRadius:2,display:'inline-block'}}/>Receber</span>
                <span style={{ fontSize:11, display:'flex', alignItems:'center', gap:5 }}><span style={{ width:10,height:10,background:'var(--vermelho)',borderRadius:2,display:'inline-block'}}/>Pagar</span>
              </div>
            </div>

            {/* Despesas por categoria */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--azul)', marginBottom:16, fontSize:15 }}>🏷️ Despesas por categoria</h3>
              {catEntradas.length===0 ? <p style={{ color:'var(--cinza)', fontSize:13 }}>Nenhuma despesa no mês.</p> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {catEntradas.slice(0,7).map(([cat,val])=>(
                    <div key={cat}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:12, fontWeight:600 }}>{cat}</span>
                        <span style={{ fontSize:12, fontWeight:800, color:'var(--vermelho)' }}>{fmt(val)}</span>
                      </div>
                      <div style={{ height:6, background:'var(--borda)', borderRadius:3 }}>
                        <div style={{ height:'100%', width:(val/maxCat*100)+'%', background:'linear-gradient(90deg,var(--vermelho),#e74c3c88)', borderRadius:3, transition:'width .4s' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vencidos */}
          {metricas.vencidos.length>0 && (
            <div className="card" style={{ padding:'16px 20px', border:'1.5px solid var(--laranja)', background:'var(--laran-bg)', marginBottom:20 }}>
              <h3 style={{ color:'var(--laranja)', marginBottom:12, fontSize:15 }}>⚠️ Lançamentos vencidos ({metricas.vencidos.length})</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {metricas.vencidos.slice(0,6).map(l=>(
                  <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'10px 14px', borderRadius:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{l.descricao}</div>
                      <div style={{ fontSize:11, color:'var(--cinza)' }}>
                        Venceu: {new Date(l.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR')} · {TIPOS.find(t=>t.value===l.tipo)?.label}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontWeight:800, color:'var(--vermelho)', fontSize:15 }}>{fmt(l.valor)}</span>
                      {isCoord && <button className="btn btn-sm btn-success" onClick={()=>marcarPago(l)}>✅</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═════════ A RECEBER ═════════ */}
      {aba==='receber' && (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:18, flexWrap:'wrap' }}>
            <select className="form-select" style={{ width:'auto' }} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span style={{ fontSize:12, color:'var(--cinza)', marginLeft:'auto' }}>{listaReceber.length} lançamento(s) · Total: <strong style={{ color:'var(--verde)' }}>{fmt(listaReceber.reduce((s,l)=>s+Number(l.valor||0),0))}</strong></span>
            {isCoord && <button className="btn btn-success" onClick={()=>abrirNovo('receber')}>+ Nova entrada</button>}
          </div>
          {loading ? <div className="loading-center"><div className="spinner"/></div> : <TabelaLanc lista={listaReceber} tipo="receber"/>}
        </>
      )}

      {/* ═════════ A PAGAR ═════════ */}
      {aba==='pagar' && (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:18, flexWrap:'wrap' }}>
            <select className="form-select" style={{ width:'auto' }} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span style={{ fontSize:12, color:'var(--cinza)', marginLeft:'auto' }}>{listaPagar.length} lançamento(s) · Total: <strong style={{ color:'var(--vermelho)' }}>{fmt(listaPagar.reduce((s,l)=>s+Number(l.valor||0),0))}</strong></span>
            {isCoord && <button className="btn btn-danger" onClick={()=>abrirNovo('pagar')}>+ Nova despesa</button>}
          </div>
          {loading ? <div className="loading-center"><div className="spinner"/></div> : <TabelaLanc lista={listaPagar} tipo="pagar"/>}
        </>
      )}

      {/* ═════════ RELATÓRIO ═════════ */}
      {aba==='relatorio' && (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
            <label style={{ fontWeight:700, color:'var(--azul)', fontSize:13 }}>📅 Mês:</label>
            <input type="month" className="form-input" style={{ width:'auto' }}
              value={filtroMes} onChange={e=>setFiltroMes(e.target.value)} />
            <button className="btn btn-ghost btn-sm" onClick={() => gerarRelatorioFinanceiroPDF(metricas.doMes, nomeMes)}>📄 Exportar PDF</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
            {/* A Pagar */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--vermelho)', marginBottom:14, fontSize:16 }}>
                🔴 A Pagar — {nomeMes}
              </h3>
              {metricas.doMes.filter(l=>l.tipo==='pagar').length===0
                ? <p style={{ color:'var(--cinza)', fontSize:13 }}>Nenhum lançamento no mês.</p>
                : metricas.doMes.filter(l=>l.tipo==='pagar').map(l=>{
                    const stat=STATUS.find(s=>s.value===l.status)
                    return (
                      <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--vermelho-bg)', borderRadius:8, marginBottom:6, gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.descricao}</div>
                          <div style={{ fontSize:10, color:'var(--cinza)' }}>{l.categoria} · {l.data_vencimento?new Date(l.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR'):''}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                          <span style={{ background:stat?.bg, color:stat?.cor, padding:'1px 6px', borderRadius:10, fontSize:10, fontWeight:700 }}>{stat?.label}</span>
                          <span style={{ fontWeight:800, color:'var(--vermelho)', fontSize:13 }}>{fmt(l.valor)}</span>
                        </div>
                      </div>
                    )
                  })
              }
              <div style={{ borderTop:'2px solid var(--vermelho)', marginTop:12, paddingTop:10, display:'flex', justifyContent:'space-between', fontWeight:800 }}>
                <span>Total a Pagar</span>
                <span style={{ color:'var(--vermelho)', fontSize:16 }}>{fmt(metricas.totPag)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:4, color:'var(--verde)' }}>
                <span>Já pago</span><span>{fmt(metricas.pago)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:2, color:'var(--laranja)' }}>
                <span>Em aberto</span><span>{fmt(metricas.totPag-metricas.pago)}</span>
              </div>
            </div>

            {/* A Receber */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--verde)', marginBottom:14, fontSize:16 }}>
                💚 A Receber — {nomeMes}
              </h3>
              {metricas.doMes.filter(l=>l.tipo==='receber').length===0
                ? <p style={{ color:'var(--cinza)', fontSize:13 }}>Nenhum lançamento no mês.</p>
                : metricas.doMes.filter(l=>l.tipo==='receber').map(l=>{
                    const stat=STATUS.find(s=>s.value===l.status)
                    return (
                      <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--verde-bg)', borderRadius:8, marginBottom:6, gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.descricao}</div>
                          <div style={{ fontSize:10, color:'var(--cinza)' }}>{l.categoria} · {l.data_vencimento?new Date(l.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR'):''}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                          <span style={{ background:stat?.bg, color:stat?.cor, padding:'1px 6px', borderRadius:10, fontSize:10, fontWeight:700 }}>{stat?.label}</span>
                          <span style={{ fontWeight:800, color:'var(--verde)', fontSize:13 }}>{fmt(l.valor)}</span>
                        </div>
                      </div>
                    )
                  })
              }
              <div style={{ borderTop:'2px solid var(--verde)', marginTop:12, paddingTop:10, display:'flex', justifyContent:'space-between', fontWeight:800 }}>
                <span>Total a Receber</span>
                <span style={{ color:'var(--verde)', fontSize:16 }}>{fmt(metricas.totRec)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:4, color:'var(--verde)' }}>
                <span>Já recebido</span><span>{fmt(metricas.recebido)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:2, color:'var(--laranja)' }}>
                <span>Em aberto</span><span>{fmt(metricas.totRec-metricas.recebido)}</span>
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div className="card" style={{ padding:'20px 28px', background:metricas.saldo>=0?'var(--verde-bg)':'var(--vermelho-bg)', border:'2px solid '+(metricas.saldo>=0?'var(--verde)':'var(--vermelho)'), textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--cinza-medio)', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Resultado do mês</div>
            <div style={{ fontSize:36, fontWeight:900, color:metricas.saldo>=0?'var(--verde)':'var(--vermelho)', fontFamily:'var(--font-display)' }}>
              {metricas.saldo>=0?'+':''}{fmt(metricas.saldo)}
            </div>
            <div style={{ fontSize:13, color:'var(--cinza-medio)', marginTop:6 }}>
              Receitas {fmt(metricas.totRec)} − Despesas {fmt(metricas.totPag)}
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)}
        title={editando ? '✏️ Editar Lançamento' : (form.tipo==='pagar'?'🔴 Nova Conta a Pagar':'💚 Nova Conta a Receber')}
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>Cancelar</button>
          <button className={form.tipo==='pagar'?'btn btn-danger':'btn btn-success'} onClick={salvar} disabled={saving}>
            {saving?'⏳ Salvando...':editando?'Salvar':'Criar'}
          </button>
        </>}>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value,categoria:''}))}>
              {TIPOS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Descrição *</label>
          <input className="form-input" placeholder={form.tipo==='pagar'?'Ex: Conta de luz — Maio':'Ex: Doação Prefeitura'}
            value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Valor (R$) *</label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00"
              value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
              <option value="">Selecione...</option>
              {(form.tipo==='pagar'?CAT_PAGAR:CAT_RECEBER).map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Vencimento *</label>
            <input className="form-input" type="date" value={form.data_vencimento} onChange={e=>setForm(f=>({...f,data_vencimento:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Data Pagamento</label>
            <input className="form-input" type="date" value={form.data_pagamento} onChange={e=>setForm(f=>({...f,data_pagamento:e.target.value}))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{form.tipo==='pagar'?'Favorecido':'Origem'}</label>
          <input className="form-input" placeholder={form.tipo==='pagar'?'Ex: Enel, fornecedor...':'Ex: Prefeitura, doador...'}
            value={form.favorecido} onChange={e=>setForm(f=>({...f,favorecido:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <textarea className="form-textarea" rows="2" placeholder="Observações..."
            value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} />
        </div>
      </Modal>
    </div>
  )
}
