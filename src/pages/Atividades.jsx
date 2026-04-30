import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import SelectCadastravel from '../components/SelectCadastravel'
import RoteiroModal from '../components/RoteiroModal'
import { abrirGoogleCalendar, formatarData } from "../lib/utils";

// Gera lista de presença com nomes dos participantes cadastrados
function gerarListaPresencaHTML(atividade, participantesSelecionados) {
  const dataFmt = atividade.data
    ? new Date(atividade.data + 'T12:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
    : ''

  const linhasCriancas = participantesSelecionados.filter(p => p.tipo === 'crianca')
  const linhasAdultos  = participantesSelecionados.filter(p => p.tipo === 'adulto')

  // Preenche linhas vazias até o estimado
  const qtdCriancas = Math.max(linhasCriancas.length, atividade.qtd_criancas || 0)
  const qtdAdultos  = Math.max(linhasAdultos.length,  atividade.qtd_adultos  || 0)

  const renderLinhas = (pessoasNamed, totalLinhas, tipo) => {
    const linhas = []
    for (let i = 0; i < totalLinhas; i++) {
      const p = pessoasNamed[i]
      linhas.push(`<tr>
        <td style="text-align:center;color:#888;width:32px">${i + 1}</td>
        <td style="padding:0 12px"><strong>${p ? p.nome : ''}</strong></td>
        ${tipo === 'Criança' ? `<td style="text-align:center;font-size:12px;color:#555">${p?.idade ? p.idade + 'a' : ''}</td>` : ''}
        <td style="height:36px;width:90px"></td>
        ${tipo === 'Criança' ? `<td style="width:120px;font-size:11px;color:#666">${p?.nome_responsavel ? (p.parentesco||'') + ': ' + p.nome_responsavel : ''}</td>` : ''}
      </tr>`)
    }
    return linhas.join('')
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lista de Presença — ${atividade.titulo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Nunito',Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:13px}
    .header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}
    .header h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#1a3a6b;margin:6px 0 2px}
    .header .sub{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase}
    .info{background:#f2f5fb;border-radius:10px;padding:12px 16px;margin-bottom:18px}
    .info h2{font-family:'Cormorant Garamond',serif;font-size:17px;color:#1a3a6b;margin-bottom:6px}
    .info-row{display:flex;gap:24px;font-size:12px;color:#555}
    .totais{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
    .total-box{background:#e8eef8;padding:8px 14px;border-radius:8px;font-size:12px}
    .total-box strong{color:#1a3a6b;font-size:16px;display:block}
    h3{font-size:13px;font-weight:800;color:#1a3a6b;text-transform:uppercase;letter-spacing:.8px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #dce3f0}
    table{width:100%;border-collapse:collapse;margin-bottom:18px}
    th{background:#1a3a6b;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px}
    td{padding:0 10px;border:1px solid #dce3f0}
    tr:nth-child(even){background:#f8faff}
    .assinatura{margin-top:28px;display:flex;justify-content:space-between}
    .assin-box{text-align:center;width:45%}
    .assin-linha{height:1px;background:#333;margin:0 auto 5px;width:100%}
    .footer{margin-top:22px;text-align:center;font-size:10px;color:#888;border-top:1px solid #dce3f0;padding-top:12px}
    @media print{button{display:none!important}}
  </style>
</head>
<body>
  <div class="header">
    <div class="sub">Instituto Nossa Senhora Menina</div>
    <h1>Lista de Presença</h1>
    <div class="sub" style="margin-top:2px">Portal Administrativo</div>
  </div>
  <div class="info">
    <h2>${atividade.titulo}</h2>
    <div class="info-row">
      <span>📅 ${dataFmt}</span>
      ${atividade.local ? `<span>📍 ${atividade.local}</span>` : ''}
      ${atividade.tema ? `<span>🎯 ${atividade.tema}</span>` : ''}
    </div>
  </div>
  <div class="totais">
    <div class="total-box"><strong>${qtdCriancas}</strong>crianças previstas</div>
    <div class="total-box"><strong>${qtdAdultos}</strong>adultos previstos</div>
    <div class="total-box"><strong>${qtdCriancas + qtdAdultos}</strong>total previsto</div>
    ${participantesSelecionados.length > 0 ? `<div class="total-box" style="background:#eaf5ee"><strong style="color:#2e7d52">${participantesSelecionados.length}</strong>com nome pré-preenchido</div>` : ''}
  </div>
  ${qtdCriancas > 0 ? `
  <h3>👧 Crianças</h3>
  <table>
    <thead><tr><th>#</th><th>Nome Completo</th><th style='text-align:center;width:50px'>Idade</th><th>Assinatura</th><th>Responsável</th></tr></thead>
    <tbody>${renderLinhas(linhasCriancas, qtdCriancas, 'Criança')}</tbody>
  </table>` : ''}
  ${qtdAdultos > 0 ? `
  <h3>👨 Adultos</h3>
  <table>
    <thead><tr><th>#</th><th>Nome Completo</th><th>Tipo</th><th>Assinatura</th></tr></thead>
    <tbody>${renderLinhas(linhasAdultos, qtdAdultos, 'Adulto')}</tbody>
  </table>` : ''}
  <div class="assinatura">
    <div class="assin-box"><div class="assin-linha"></div><div style="font-size:11px;color:#666">Responsável pela Atividade</div></div>
    <div class="assin-box"><div class="assin-linha"></div><div style="font-size:11px;color:#666">Coordenação</div></div>
  </div>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  <div style="text-align:center;margin-top:14px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:Nunito,sans-serif;font-weight:700">
      🖨️ Imprimir Lista de Presença
    </button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=700')
  win.document.write(html)
  win.document.close()
}

export default function Atividades() {
  const { isCoord, user } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [participantes, setParticipantes] = useState([]) // cadastrados no sistema
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPresenca, setModalPresenca] = useState(null)
  const [editando, setEditando] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const EMPTY = { titulo:'', data:'', hora_inicio:'', hora_fim:'', local:'', tema:'', descricao:'', qtd_criancas:'', qtd_adultos:'', insumos:'' }
  const [form, setForm] = useState(EMPTY)
  const [tarefas, setTarefas] = useState([])
  const [novaTarefa, setNovaTarefa] = useState({ pessoa_id:'', tarefa:'' })
  // Para lista de presença
  const [participantesSelecionados, setParticipantesSelecionados] = useState([])
  const [buscaParticipante, setBuscaParticipante] = useState('')
  // Para roteiro
  const [roteiroAtividade, setRoteiroAtividade] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [atRes, coordRes, dirRes, partRes] = await Promise.all([
      supabase.from('atividades').select('*, tarefas_atividade(*)').order('data', { ascending:false }),
      supabase.from('coordenadores').select('id,nome,area').eq('ativo',true).order('nome'),
      supabase.from('diretores').select('id,nome,area').eq('ativo',true).order('nome'),
      supabase.from('participantes').select('id,nome,tipo,idade,nome_responsavel,parentesco').order('nome'),
    ])
    setLista(atRes.data || [])
    setPessoas([
      ...(dirRes.data || []).map(d => ({ ...d, tipo:'diretor' })),
      ...(coordRes.data || []).map(c => ({ ...c, tipo:'coordenador' })),
    ])
    setParticipantes(partRes.data || [])
    setLoading(false)
  }

  function abrirNovo() {
    setForm(EMPTY); setEditando(null); setTarefas([]); setNovaTarefa({ pessoa_id:'', tarefa:'' }); setModalOpen(true)
  }
  function abrirEditar(a) {
    setForm({ titulo:a.titulo, data:a.data, hora_inicio:a.hora_inicio||'', hora_fim:a.hora_fim||'', local:a.local||'', tema:a.tema||'', descricao:a.descricao||'', qtd_criancas:a.qtd_criancas||'', qtd_adultos:a.qtd_adultos||'', insumos:a.insumos||'' })
    setTarefas(a.tarefas_atividade || [])
    setEditando(a.id); setModalOpen(true)
  }

  function adicionarTarefa() {
    if (!novaTarefa.pessoa_id || !novaTarefa.tarefa.trim()) { toast('Selecione uma pessoa e descreva a tarefa.', 'error'); return }
    const pessoa = pessoas.find(p => p.id === novaTarefa.pessoa_id)
    setTarefas(t => [...t, { pessoa_id:novaTarefa.pessoa_id, pessoa_nome:pessoa?.nome||'', pessoa_tipo:pessoa?.tipo||'', tarefa:novaTarefa.tarefa.trim() }])
    setNovaTarefa({ pessoa_id:'', tarefa:'' })
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.data) { toast('Título e data são obrigatórios.', 'error'); return }
    setSaving(true)
    const payload = { ...form, qtd_criancas:parseInt(form.qtd_criancas)||0, qtd_adultos:parseInt(form.qtd_adultos)||0, criado_por:user?.id }
    let atividadeId = editando, error
    if (editando) {
      ;({ error } = await supabase.from('atividades').update({ ...payload, atualizado_em:new Date().toISOString() }).eq('id', editando))
      if (!error) await supabase.from('tarefas_atividade').delete().eq('atividade_id', editando)
    } else {
      const res = await supabase.from('atividades').insert(payload).select('id').single()
      error = res.error; atividadeId = res.data?.id
    }
    if (!error && atividadeId && tarefas.length > 0) {
      await supabase.from('tarefas_atividade').insert(tarefas.map(t => ({ atividade_id:atividadeId, pessoa_id:t.pessoa_id, pessoa_nome:t.pessoa_nome, pessoa_tipo:t.pessoa_tipo, tarefa:t.tarefa })))
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Atividade atualizada!' : '✅ Atividade criada!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function mudarStatus(id, status) {
    await supabase.from('atividades').update({ status, atualizado_em:new Date().toISOString() }).eq('id', id)
    toast(status === 'realizada' ? '✅ Atividade realizada!' : 'Status atualizado.')
    load()
  }

  async function remover(id) {
    if (!confirm('Excluir esta atividade?')) return
    await supabase.from('atividades').delete().eq('id', id)
    toast('Atividade excluída.'); setExpandido(null); load()
  }

  function toggleParticipante(p) {
    setParticipantesSelecionados(sel =>
      sel.find(s => s.id === p.id)
        ? sel.filter(s => s.id !== p.id)
        : [...sel, p]
    )
  }

  const filtradas = lista.filter(a => {
    const mS = filtroStatus === 'todos' || a.status === filtroStatus
    const mB = !busca || a.titulo.toLowerCase().includes(busca.toLowerCase()) || (a.local||'').toLowerCase().includes(busca.toLowerCase())
    return mS && mB
  })
  const hoje = new Date().toISOString().slice(0, 10)

  // Participantes filtrados para busca na lista de presença
  const participantesFiltrados = participantes.filter(p =>
    !buscaParticipante || p.nome.toLowerCase().includes(buscaParticipante.toLowerCase())
  )

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">🗓️ Planejamento de Atividades</h1><p className="page-subtitle">Gerencie atividades e atribua tarefas à equipe</p></div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={() => toast('Use o botão 📅 em cada atividade.', 'info')}>📅 Agenda</button>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>+ Nova Atividade</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <div className="tabs">
          {[['todos','Todas'],['planejada','📅 Planejadas'],['realizada','✅ Realizadas'],['cancelada','❌ Canceladas']].map(([v,l]) => (
            <button key={v} className={`tab ${filtroStatus===v?'active':''}`} onClick={() => setFiltroStatus(v)}>{l}</button>
          ))}
        </div>
        <div className="search-wrap" style={{ flex:1, minWidth:160 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div>
      : filtradas.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🗓️</span>
          <h3>Nenhuma atividade</h3>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>Criar atividade</button>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtradas.map(a => {
            const aberto = expandido === a.id
            return (
              <div key={a.id} className="ativ-card">
                <div className="ativ-header" onClick={() => setExpandido(aberto ? null : a.id)}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                      <div className="ativ-title">{a.titulo}</div>
                      <span className={`badge badge-${a.status}`}>{a.status==='planejada'?'📅':a.status==='realizada'?'✅':'❌'} {a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span>
                      {(a.tarefas_atividade?.length > 0) && <span style={{ fontSize:11, background:'var(--dourado-bg)', color:'var(--dourado)', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>👥 {a.tarefas_atividade.length}</span>}
                    </div>
                    <div className="ativ-meta">
                      <span>📅 {formatarData(a.data)}</span>
                      {a.hora_inicio && <span>⏰ {a.hora_inicio}{a.hora_fim?`–${a.hora_fim}`:''}</span>}
                      {a.local && <span>📍 {a.local}</span>}
                      <span>👧 {a.qtd_criancas||0}</span>
                      <span>👨 {a.qtd_adultos||0}</span>
                      {a.tema && <span>🎯 {a.tema}</span>}
                      {a.data < hoje && a.status === 'planejada' && <span style={{ color:'var(--laranja)', fontWeight:700 }}>⚠ Passada</span>}
                    </div>
                  </div>
                  <span style={{ color:'var(--cinza)', fontSize:18, transition:'transform .2s', transform:aberto?'rotate(180deg)':'', flexShrink:0 }}>▾</span>
                </div>

                {aberto && (
                  <div className="ativ-body">
                    <div className="ativ-body-inner">
                      {a.descricao && <p style={{ fontSize:13.5, color:'var(--cinza-medio)', marginBottom:14, lineHeight:1.6 }}>{a.descricao}</p>}
                      {a.insumos && (
                        <div style={{ background:'var(--creme)', padding:'10px 14px', borderRadius:8, marginBottom:14 }}>
                          <strong style={{ fontSize:11, color:'var(--azul)', fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px' }}>📦 Insumos</strong>
                          <p style={{ fontSize:13, color:'var(--cinza-medio)', marginTop:5 }}>{a.insumos}</p>
                        </div>
                      )}
                      {a.tarefas_atividade?.length > 0 && (
                        <div style={{ marginBottom:14 }}>
                          <strong style={{ fontSize:11, color:'var(--azul)', fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:8 }}>👥 Equipe & Tarefas</strong>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {a.tarefas_atividade.map((t, i) => (
                              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'9px 12px', background:'var(--creme)', borderRadius:8, border:'1px solid var(--borda)' }}>
                                <div style={{ width:30, height:30, borderRadius:'50%', background:t.pessoa_tipo==='diretor'?'linear-gradient(135deg,#0d2347,#1a3a6b)':'linear-gradient(135deg,var(--azul),var(--azul-claro))', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:11, flexShrink:0 }}>
                                  {(t.pessoa_nome||'?').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                                </div>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:13, fontWeight:700, color:'var(--azul)' }}>{t.pessoa_nome} <span style={{ fontSize:10, background:'var(--cinza-cl)', color:'var(--cinza-medio)', padding:'1px 6px', borderRadius:10 }}>{t.pessoa_tipo==='diretor'?'🏛️':'👤'}</span></div>
                                  <div style={{ fontSize:12.5, color:'var(--cinza-medio)', marginTop:2 }}>{t.tarefa}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => { setModalPresenca(a); setParticipantesSelecionados([]); setBuscaParticipante('') }}>🖨️ Lista de Presença</button>
                        <button className="btn btn-sm btn-outline" onClick={() => setRoteiroAtividade(a)}>📋 Roteiro</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => abrirGoogleCalendar(a)}>📅 Google Agenda</button>
                        {a.status === 'planejada' && isCoord && <button className="btn btn-sm btn-success" onClick={() => mudarStatus(a.id, 'realizada')}>✅ Marcar Realizada</button>}
                        {a.status === 'planejada' && isCoord && <button className="btn btn-sm btn-ghost" style={{ color:'var(--vermelho)' }} onClick={() => mudarStatus(a.id, 'cancelada')}>❌ Cancelar</button>}
                        {isCoord && <><button className="btn btn-sm btn-ghost" style={{ color:'var(--azul)' }} onClick={() => abrirEditar(a)}>✏️ Editar</button><button className="btn btn-sm btn-danger" onClick={() => remover(a.id)}>🗑</button></>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? '✏️ Editar Atividade' : '🗓️ Nova Atividade'} size="lg"
        footer={<><button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? '⏳...' : editando ? 'Salvar' : 'Criar Atividade'}</button></>}>
        <div style={{ fontWeight:800, fontSize:11.5, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.8, marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--borda)' }}>📋 Dados da Atividade</div>
        <div className="form-group"><label className="form-label">Título *</label><input className="form-input" placeholder="Ex: Retiro Infantil de Nossa Senhora" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo:e.target.value }))}/></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Data *</label><input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data:e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Local</label><SelectCadastravel categoria="locais_atividade" value={form.local} onChange={v => setForm(f => ({ ...f, local:v }))} placeholder="Selecione..."/></div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Início</label><input className="form-input" type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio:e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Fim</label><input className="form-input" type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim:e.target.value }))}/></div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Nº Estimado Crianças</label><input className="form-input" type="number" min="0" placeholder="0" value={form.qtd_criancas} onChange={e => setForm(f => ({ ...f, qtd_criancas:e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Nº Estimado Adultos</label><input className="form-input" type="number" min="0" placeholder="0" value={form.qtd_adultos} onChange={e => setForm(f => ({ ...f, qtd_adultos:e.target.value }))}/></div>
        </div>
        <div className="form-group"><label className="form-label">Tema</label><SelectCadastravel categoria="temas_atividade" value={form.tema} onChange={v => setForm(f => ({ ...f, tema:v }))} placeholder="Selecione..."/></div>
        <div className="form-group"><label className="form-label">Descrição</label><textarea className="form-textarea" rows="2" placeholder="Objetivos..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao:e.target.value }))}/></div>
        <div className="form-group"><label className="form-label">Insumos Necessários</label><textarea className="form-textarea" rows="2" placeholder="Ex: 50 folhas sulfite, 30 lápis de cor..." value={form.insumos} onChange={e => setForm(f => ({ ...f, insumos:e.target.value }))}/></div>

        <div style={{ fontWeight:800, fontSize:11.5, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.8, margin:'18px 0 12px', paddingTop:14, borderTop:'1px solid var(--borda)' }}>👥 Atribuir Tarefas à Equipe</div>
        {pessoas.length === 0 ? <div className="alert alert-gold"><span className="alert-icon">ℹ️</span><div style={{ fontSize:12.5 }}>Cadastre diretores ou coordenadores primeiro.</div></div>
        : (
          <>
            {tarefas.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                {tarefas.map((t, i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'var(--creme)', borderRadius:8, border:'1px solid var(--borda)' }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:t.pessoa_tipo==='diretor'?'linear-gradient(135deg,#0d2347,#1a3a6b)':'linear-gradient(135deg,var(--azul),var(--azul-claro))', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:10, flexShrink:0 }}>
                      {(t.pessoa_nome||'?').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight:700, color:'var(--azul)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.pessoa_nome}</div>
                      <div style={{ fontSize:12, color:'var(--cinza-medio)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.tarefa}</div>
                    </div>
                    <button onClick={() => setTarefas(ts => ts.filter((_,j)=>j!==i))} style={{ background:'var(--vermelho)', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12, flexShrink:0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background:'var(--cinza-cl)', borderRadius:10, padding:12, border:'1px solid var(--borda)' }}>
              <div className="form-group" style={{ marginBottom:8 }}>
                <label className="form-label">Pessoa</label>
                <select className="form-select" value={novaTarefa.pessoa_id} onChange={e => setNovaTarefa(t => ({ ...t, pessoa_id:e.target.value }))}>
                  <option value="">Selecione...</option>
                  {pessoas.filter(p=>p.tipo==='diretor').length > 0 && <optgroup label="🏛️ Diretores">{pessoas.filter(p=>p.tipo==='diretor').map(p=><option key={p.id} value={p.id}>{p.nome} — {p.area}</option>)}</optgroup>}
                  {pessoas.filter(p=>p.tipo==='coordenador').length > 0 && <optgroup label="👤 Coordenadores">{pessoas.filter(p=>p.tipo==='coordenador').map(p=><option key={p.id} value={p.id}>{p.nome} — {p.area}</option>)}</optgroup>}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom:10 }}>
                <label className="form-label">Tarefa</label>
                <input className="form-input" placeholder="Ex: Organizar o salão e preparar materiais" value={novaTarefa.tarefa} onChange={e => setNovaTarefa(t => ({ ...t, tarefa:e.target.value }))} onKeyDown={e => e.key === 'Enter' && adicionarTarefa()}/>
              </div>
              <button className="btn btn-sm btn-primary" onClick={adicionarTarefa} style={{ width:'100%', justifyContent:'center' }}>+ Atribuir Tarefa</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Modal Roteiro ── */}
      {roteiroAtividade && (
        <RoteiroModal
          atividade={roteiroAtividade}
          onClose={() => setRoteiroAtividade(null)}
        />
      )}

      {/* ── Modal Lista de Presença ── */}
      <Modal open={!!modalPresenca} onClose={() => setModalPresenca(null)} title="🖨️ Lista de Presença" size="lg"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalPresenca(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { gerarListaPresencaHTML(modalPresenca, participantesSelecionados); setModalPresenca(null) }}>
            🖨️ Gerar Lista ({participantesSelecionados.length > 0 ? `${participantesSelecionados.length} selecionados` : 'só linhas em branco'})
          </button>
        </>}>
        {modalPresenca && (
          <>
            <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--azul)', fontWeight:700, marginBottom:10 }}>📋 {modalPresenca.titulo}</div>
            <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', fontSize:12.5, color:'var(--cinza-medio)' }}>
              <span>📅 {formatarData(modalPresenca.data)}</span>
              {modalPresenca.local && <span>📍 {modalPresenca.local}</span>}
              <span>👧 {modalPresenca.qtd_criancas||0} crianças previstas</span>
              <span>👨 {modalPresenca.qtd_adultos||0} adultos previstos</span>
            </div>

            <div className="alert alert-blue" style={{ marginBottom:14 }}>
              <span className="alert-icon">ℹ️</span>
              <div style={{ fontSize:12.5 }}>
                Selecione participantes cadastrados para pré-preencher os nomes na lista. Linhas em branco serão adicionadas até completar o número estimado.
              </div>
            </div>

            {participantes.length > 0 ? (
              <>
                <div className="search-wrap" style={{ marginBottom:12 }}>
                  <span className="search-icon">🔍</span>
                  <input placeholder="Buscar participante..." value={buscaParticipante} onChange={e => setBuscaParticipante(e.target.value)} />
                </div>
                <div style={{ maxHeight:260, overflowY:'auto', border:'1px solid var(--borda)', borderRadius:10, padding:8 }}>
                  {/* Crianças */}
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.6, padding:'4px 8px 6px' }}>👧 Crianças</div>
                  {participantesFiltrados.filter(p=>p.tipo==='crianca').map(p => {
                    const sel = participantesSelecionados.find(s=>s.id===p.id)
                    return (
                      <div key={p.id} onClick={() => toggleParticipante(p)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:sel?'var(--azul-suave)':'white', marginBottom:3, transition:'background .15s' }}>
                        <div style={{ width:20, height:20, border:`2px solid ${sel?'var(--azul)':'var(--borda)'}`, borderRadius:4, background:sel?'var(--azul)':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, color:'white', transition:'all .15s' }}>{sel?'✓':''}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--azul)' }}>{p.nome}</div>
                          <div style={{ fontSize:11, color:'var(--cinza)' }}>{p.idade ? `${p.idade} anos` : ''}{p.nome_responsavel ? ` · ${p.parentesco}: ${p.nome_responsavel}` : ''}</div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Adultos */}
                  {participantesFiltrados.filter(p=>p.tipo==='adulto').length > 0 && <>
                    <div style={{ fontSize:11, fontWeight:800, color:'var(--verde)', textTransform:'uppercase', letterSpacing:.6, padding:'10px 8px 6px', marginTop:4 }}>👨 Adultos</div>
                    {participantesFiltrados.filter(p=>p.tipo==='adulto').map(p => {
                      const sel = participantesSelecionados.find(s=>s.id===p.id)
                      return (
                        <div key={p.id} onClick={() => toggleParticipante(p)}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:sel?'var(--verde-bg)':'white', marginBottom:3, transition:'background .15s' }}>
                          <div style={{ width:20, height:20, border:`2px solid ${sel?'var(--verde)':'var(--borda)'}`, borderRadius:4, background:sel?'var(--verde)':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, color:'white' }}>{sel?'✓':''}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--texto)' }}>{p.nome}</div>
                          </div>
                        </div>
                      )
                    })}
                  </>}
                </div>
                {participantesSelecionados.length > 0 && (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'var(--verde-bg)', borderRadius:8, fontSize:12.5, color:'var(--verde)', fontWeight:700 }}>
                    ✅ {participantesSelecionados.length} participante(s) selecionado(s) para pré-preencher a lista
                  </div>
                )}
              </>
            ) : (
              <div className="alert alert-gold">
                <span className="alert-icon">💡</span>
                <div style={{ fontSize:12.5 }}>Nenhum participante cadastrado. A lista será gerada com linhas em branco. Cadastre participantes em <strong>👧 Participantes</strong> para pré-preencher.</div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
