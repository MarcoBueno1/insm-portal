import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import SelectCadastravel from '../components/SelectCadastravel'
import { gerarRelatorioEstoquePDF } from '../lib/pdf'

const EMPTY = { produto: '', categoria: '', qtd_atual: '', qtd_minima: '', unidade: 'un', observacao: '' }

// Helper para determinar o status
const st = (qtd, min) => qtd <= 0 ? 'critico' : qtd <= min ? 'baixo' : 'ok'

const ST = {
  ok: { bg: 'var(--verde-bg)', cor: 'var(--verde)', ic: '✅ OK' },
  baixo: { bg: 'var(--laran-bg)', cor: 'var(--laranja)', ic: '⚠️ Baixo' },
  critico: { bg: 'var(--verm-bg)', cor: 'var(--vermelho)', ic: '🔴 Crítico' }
}

export default function Estoque() {
  const { isCoord, nomeUser, user } = useAuth()
  const toast = useToast()
  
  const [lista, setLista] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modais e formulários
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMov, setModalMov] = useState(null)
  const [modalHist, setModalHist] = useState(null)
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)
  
  // Filtros e Busca
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  
  // Estado para ordenação
  const [ordem, setOrdem] = useState('alfabetica') // 'alfabetica' | 'criticidade'

  const [form, setForm] = useState(EMPTY)
  const [mov, setMov] = useState({ tipo: 'entrada', quantidade: '', motivo: '' })
  const [tab, setTab] = useState('estoque')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [estRes, movRes] = await Promise.all([
      supabase.from('estoque').select('*').order('produto'),
      supabase.from('movimentacoes_estoque').select('*, estoque(produto)').order('criado_em', { ascending: false }).limit(50),
    ])
    setLista(estRes.data || [])
    setHistorico(movRes.data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModalOpen(true) }
  
  function abrirEditar(item) {
    setForm({
      produto: item.produto,
      categoria: item.categoria || '',
      qtd_atual: item.qtd_atual,
      qtd_minima: item.qtd_minima,
      unidade: item.unidade || 'un',
      observacao: item.observacao || ''
    })
    setEditando(item.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.produto.trim()) { toast('Informe o produto.', 'error'); return }
    setSaving(true)
    const payload = { ...form, qtd_atual: parseFloat(form.qtd_atual) || 0, qtd_minima: parseFloat(form.qtd_minima) || 0 }
    let error
    
    if (editando) {
      ;({ error } = await supabase.from('estoque').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando))
      if (!error) {
        await supabase.from('movimentacoes_estoque').insert({
          estoque_id: editando,
          tipo: 'edicao',
          quantidade: 0,
          motivo: `Edição por ${nomeUser}`,
          usuario_nome: nomeUser,
          usuario_id: user?.id
        })
      }
    } else {
      const res = await supabase.from('estoque').insert(payload).select('id').single()
      error = res.error
      if (!error) {
        await supabase.from('movimentacoes_estoque').insert({
          estoque_id: res.data.id,
          tipo: 'cadastro',
          quantidade: parseFloat(form.qtd_atual) || 0,
          motivo: `Cadastrado por ${nomeUser}`,
          usuario_nome: nomeUser,
          usuario_id: user?.id
        })
      }
    }

    if (error) toast('Erro: ' + error.message, 'error')
    else {
      toast(editando ? 'Item atualizado!' : '✅ Item cadastrado!')
      setModalOpen(false)
      load()
    }
    setSaving(false)
  }

  async function registrarMov() {
    if (!mov.quantidade || parseFloat(mov.quantidade) <= 0) { toast('Informe a quantidade.', 'error'); return }
    setSaving(true)
    const item = modalMov
    const delta = mov.tipo === 'entrada' ? parseFloat(mov.quantidade) : -parseFloat(mov.quantidade)
    const novaQtd = Math.max(0, item.qtd_atual + delta)
    
    const { error } = await supabase.from('estoque').update({ qtd_atual: novaQtd, atualizado_em: new Date().toISOString() }).eq('id', item.id)
    
    if (!error) {
      await supabase.from('movimentacoes_estoque').insert({
        estoque_id: item.id,
        tipo: mov.tipo,
        quantidade: parseFloat(mov.quantidade),
        motivo: mov.motivo || `${mov.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada por ${nomeUser}`,
        usuario_nome: nomeUser,
        usuario_id: user?.id,
        qtd_antes: item.qtd_atual,
        qtd_depois: novaQtd,
      })
    }
    
    if (error) toast('Erro: ' + error.message, 'error')
    else {
      toast(mov.tipo === 'entrada' ? '📥 Entrada registrada!' : '📤 Saída registrada!')
      setModalMov(null); setMov({ tipo: 'entrada', quantidade: '', motivo: '' }); load()
    }
    setSaving(false)
  }

  async function remover(id, produto) {
    if (!confirm(`Excluir "${produto}" do estoque?`)) return
    await supabase.from('movimentacoes_estoque').insert({
      estoque_id: id,
      tipo: 'exclusao',
      quantidade: 0,
      motivo: `Excluído por ${nomeUser}`,
      usuario_nome: nomeUser,
      usuario_id: user?.id
    })
    await supabase.from('estoque').delete().eq('id', id)
    toast('Item removido.'); load()
  }

  // Lógica de filtragem e ordenação CORRIGIDA
  const filtrados = lista
    .filter(e => {
      const s = st(e.qtd_atual, e.qtd_minima)
      const mF = filtro === 'todos' || s === filtro
      const termoBusca = busca.toLowerCase().trim()
      const mB = !termoBusca || 
                 e.produto.toLowerCase().includes(termoBusca) || 
                 (e.categoria || '').toLowerCase().includes(termoBusca)
      return mF && mB
    })
    .sort((a, b) => {
      if (ordem === 'alfabetica') {
        // Ordenação alfabética robusta: ignora case e trata acentos corretamente
        const nomeA = a.produto.trim();
        const nomeB = b.produto.trim();
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
      } else {
        // Ordem por criticidade: Crítico (0) > Baixo (1) > OK (2)
        const scoreA = st(a.qtd_atual, a.qtd_minima) === 'critico' ? 0 : st(a.qtd_atual, a.qtd_minima) === 'baixo' ? 1 : 2
        const scoreB = st(b.qtd_atual, b.qtd_minima) === 'critico' ? 0 : st(b.qtd_atual, b.qtd_minima) === 'baixo' ? 1 : 2
        
        if (scoreA !== scoreB) return scoreA - scoreB
        
        // Desempate alfabético dentro da mesma categoria de status
        const nomeA = a.produto.trim();
        const nomeB = b.produto.trim();
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
      }
    })

  const criticos = lista.filter(e => st(e.qtd_atual, e.qtd_minima) === 'critico').length
  const baixos = lista.filter(e => st(e.qtd_atual, e.qtd_minima) === 'baixo').length
  const histDoItem = modalHist ? historico.filter(h => h.estoque_id === modalHist.id) : []

  const TIPO_LABEL = { entrada: '📥 Entrada', saida: '📤 Saída', cadastro: '➕ Cadastro', edicao: '✏️ Edição', exclusao: '🗑 Exclusão' }
  const TIPO_COR = { entrada: 'var(--verde)', saida: 'var(--laranja)', cadastro: 'var(--azul)', edicao: 'var(--cinza-medio)', exclusao: 'var(--vermelho)' }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Controle de Estoque</h1>
          <p className="page-subtitle">Produtos, movimentações e auditoria completa</p>
        </div>
        <div className="page-actions">
          {/* Passa a lista já filtrada e ordenada para o PDF */}
          <button className="btn btn-ghost btn-sm" onClick={() => gerarRelatorioEstoquePDF(filtrados, ordem)}>📄 PDF</button>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>+ Cadastrar Item</button>}
        </div>
      </div>

      {(criticos > 0 || baixos > 0) && (
        <div className="alert alert-red" style={{ marginBottom: 18 }}>
          <span className="alert-icon">⚠️</span>
          <div>
            {criticos > 0 && <><strong>{criticos} item(s) crítico(s)</strong> — estoque zerado. </>}
            {baixos > 0 && <><strong>{baixos} item(s) baixo(s)</strong> — abaixo do mínimo.</>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={`tab ${tab === 'estoque' ? 'active' : ''}`} onClick={() => setTab('estoque')}>📦 Estoque Atual</button>
        <button className={`tab ${tab === 'historico' ? 'active' : ''}`} onClick={() => setTab('historico')}>📋 Histórico de Movimentações</button>
      </div>

      {tab === 'estoque' && (
        <>
          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            {[{ ic: '📦', v: lista.length, l: 'Total', c: 'var(--azul)' }, { ic: '⚠️', v: baixos, l: 'Baixo', c: 'var(--laranja)' }, { ic: '🔴', v: criticos, l: 'Crítico', c: 'var(--vermelho)' }].map(s => (
              <div key={s.l} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--borda)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{s.ic}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--cinza)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, marginTop: 2 }}>{s.l}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Itens em Estoque</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                
                {/* Seletor de Ordenação */}
                <div className="tabs" style={{ marginBottom: 0 }}>
                  <button className={`tab ${ordem === 'alfabetica' ? 'active' : ''}`} onClick={() => setOrdem('alfabetica')}>A-Z</button>
                  <button className={`tab ${ordem === 'criticidade' ? 'active' : ''}`} onClick={() => setOrdem('criticidade')}>Status</button>
                </div>

                <div className="tabs" style={{ marginBottom: 0 }}>
                  {[['todos', 'Todos'], ['ok', '✅'], ['baixo', '⚠️'], ['critico', '🔴']].map(([v, l]) => (
                    <button key={v} className={`tab ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
                  ))}
                </div>
                
                <div className="search-wrap" style={{ minWidth: 0, flex: 1 }}>
                  <span className="search-icon">🔍</span>
                  <input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
              </div>
            </div>

            {loading ? <div className="loading-center"><div className="spinner" /></div>
              : filtrados.length === 0 ? (
                <div className="empty-state"><span className="empty-icon">📦</span><h3>Nenhum item</h3>{isCoord && <button className="btn btn-gold" onClick={abrirNovo}>Cadastrar</button>}</div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="hide-desktop" style={{ padding: '10px' }}>
                    {filtrados.map(e => {
                      const s = st(e.qtd_atual, e.qtd_minima); const si = ST[s]
                      return (
                        <div key={e.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--borda)', display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--azul)' }}>{e.produto}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--cinza)', marginTop: 2 }}>{e.categoria} · {e.qtd_minima} mín</div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 50 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: si.cor }}>{e.qtd_atual}</div>
                            <div style={{ fontSize: 10, color: 'var(--cinza)' }}>{e.unidade}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: si.bg, color: si.cor, whiteSpace: 'nowrap' }}>{si.ic}</span>
                          {isCoord && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button className="btn btn-sm btn-success" style={{ padding: '5px 8px' }} onClick={() => { setModalMov(e); setMov({ tipo: 'entrada', quantidade: '', motivo: '' }) }}>📥📤</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop: tabela */}
                  <div className="table-wrap hide-mobile">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th><th>Categoria</th>
                          <th style={{ textAlign: 'center' }}>Qtd Atual</th>
                          <th style={{ textAlign: 'center' }}>Qtd Mín</th>
                          <th style={{ textAlign: 'center' }}>Un</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th>Última alteração</th>
                          {isCoord && <th style={{ textAlign: 'center' }}>Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.map(e => {
                          const s = st(e.qtd_atual, e.qtd_minima); const si = ST[s]
                          return (
                            <tr key={e.id}>
                              <td>
                                <strong style={{ color: 'var(--azul)' }}>{e.produto}</strong>
                                {e.observacao && <div style={{ fontSize: 11, color: 'var(--cinza)' }}>{e.observacao}</div>}
                              </td>
                              <td><span style={{ fontSize: 11.5, background: 'var(--azul-suave)', color: 'var(--azul-medio)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{e.categoria || '—'}</span></td>
                              <td style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: si.cor }}>{e.qtd_atual}</td>
                              <td style={{ textAlign: 'center', color: 'var(--cinza-medio)' }}>{e.qtd_minima}</td>
                              <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--cinza-medio)' }}>{e.unidade || 'un'}</td>
                              <td style={{ textAlign: 'center' }}><span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: si.bg, color: si.cor }}>{si.ic}</span></td>
                              <td style={{ fontSize: 11.5, color: 'var(--cinza)' }}>
                                {e.atualizado_em ? new Date(e.atualizado_em).toLocaleDateString('pt-BR') : '—'}
                              </td>
                              {isCoord && (
                                <td>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                    <button className="btn btn-sm btn-success" title="Movimentar" onClick={() => { setModalMov(e); setMov({ tipo: 'entrada', quantidade: '', motivo: '' }) }}>📥📤</button>
                                    <button className="btn btn-sm btn-ghost" title="Histórico" onClick={() => setModalHist(e)}>📋</button>
                                    <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(e)}>✏️</button>
                                    <button className="btn btn-sm btn-danger" onClick={() => remover(e.id, e.produto)}>🗑</button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </div>
        </>
      )}

      {tab === 'historico' && (
        <div className="card">
          <div className="card-header"><span className="card-title">📋 Histórico de Movimentações</span><span style={{ fontSize: 12, color: 'var(--cinza)' }}>Últimas 50 ações</span></div>
          {historico.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📋</span><h3>Nenhuma movimentação</h3></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data/Hora</th><th>Produto</th><th>Tipo</th><th style={{ textAlign: 'center' }}>Qtd</th><th>Antes → Depois</th><th>Motivo</th><th>Responsável</th></tr></thead>
                <tbody>
                  {historico.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 11.5, color: 'var(--cinza)', whiteSpace: 'nowrap' }}>{new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td><strong style={{ fontSize: 13 }}>{h.estoque?.produto || '—'}</strong></td>
                      <td><span style={{ fontSize: 11.5, fontWeight: 700, color: TIPO_COR[h.tipo] || 'var(--cinza)' }}>{TIPO_LABEL[h.tipo] || h.tipo}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: h.tipo === 'entrada' || h.tipo === 'cadastro' ? 'var(--verde)' : 'var(--laranja)' }}>{h.quantidade > 0 ? `${h.tipo === 'entrada' || h.tipo === 'cadastro' ? '+' : '−'}${h.quantidade}` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--cinza)' }}>{h.qtd_antes != null ? `${h.qtd_antes} → ${h.qtd_depois}` : '—'}</td>
                      <td style={{ fontSize: 12.5 }}>{h.motivo || '—'}</td>
                      <td><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--azul)' }}>{h.usuario_nome || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal cadastro */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? '✏️ Editar Item' : '📦 Novo Item no Estoque'}
        footer={<><button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? '⏳...' : 'Salvar'}</button></>}>
        <div className="form-group"><label className="form-label">Produto *</label><input className="form-input" placeholder="Ex: Lápis de cor caixa 12" value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Categoria</label><SelectCadastravel categoria="categorias_estoque" value={form.categoria} onChange={v => setForm(f => ({ ...f, categoria: v }))} placeholder="Selecione..." /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="form-group"><label className="form-label">Qtd Atual</label><input className="form-input" type="number" min="0" step=".5" placeholder="0" value={form.qtd_atual} onChange={e => setForm(f => ({ ...f, qtd_atual: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Qtd Mínima</label><input className="form-input" type="number" min="0" step=".5" placeholder="5" value={form.qtd_minima} onChange={e => setForm(f => ({ ...f, qtd_minima: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Unidade</label><SelectCadastravel categoria="unidades_estoque" value={form.unidade} onChange={v => setForm(f => ({ ...f, unidade: v }))} placeholder="un" /></div>
        </div>
        <div className="form-group"><label className="form-label">Observação</label><input className="form-input" placeholder="Opcional" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} /></div>
        <div className="alert alert-blue" style={{ marginTop: 4 }}>
          <span className="alert-icon">📋</span>
          <div style={{ fontSize: 12.5 }}>Esta ação será registrada no histórico com seu nome: <strong>{nomeUser}</strong></div>
        </div>
      </Modal>

      {/* Modal movimentação */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)} title={`📦 Movimentar — ${modalMov?.produto}`}
        footer={<><button className="btn btn-ghost" onClick={() => setModalMov(null)}>Cancelar</button><button className={`btn ${mov.tipo === 'entrada' ? 'btn-success' : 'btn-danger'}`} onClick={registrarMov} disabled={saving}>{saving ? '⏳...' : mov.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</button></>}>
        {modalMov && (
          <>
            <div className="alert alert-blue" style={{ marginBottom: 14 }}>
              <span className="alert-icon">📦</span>
              <div>Quantidade atual: <strong style={{ fontSize: 16 }}>{modalMov.qtd_atual}{modalMov.unidade}</strong></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['entrada', '📥 Entrada', 'var(--verde)'], ['saida', '📤 Saída', 'var(--vermelho)']].map(([v, l, c]) => (
                <button key={v} onClick={() => setMov(m => ({ ...m, tipo: v }))}
                  style={{ padding: 12, border: `2px solid ${mov.tipo === v ? c : 'var(--borda)'}`, borderRadius: 10, background: mov.tipo === v ? `${c}18` : 'white', cursor: 'pointer', fontWeight: 700, color: mov.tipo === v ? c : 'var(--cinza-medio)', fontSize: 13.5, transition: 'all .15s', fontFamily: 'var(--font-body)' }}>
                  {l}
                </button>
              ))}
            </div>
            <div className="form-group"><label className="form-label">Quantidade *</label><input className="form-input" type="number" min=".5" step=".5" placeholder="Ex: 10" value={mov.quantidade} onChange={e => setMov(m => ({ ...m, quantidade: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Motivo / Observação</label><input className="form-input" placeholder="Ex: Compra para oficina, uso na atividade..." value={mov.motivo} onChange={e => setMov(m => ({ ...m, motivo: e.target.value }))} /></div>
            {mov.quantidade && (
              <div className="alert alert-gold">
                <span className="alert-icon">ℹ️</span>
                <div>
                  Nova quantidade: <strong>{Math.max(0, modalMov.qtd_atual + (mov.tipo === 'entrada' ? 1 : -1) * parseFloat(mov.quantidade || 0))}{modalMov.unidade}</strong>
                  <br /><span style={{ fontSize: 11.5 }}>Registrado por: <strong>{nomeUser}</strong></span>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Modal histórico do item */}
      <Modal open={!!modalHist} onClose={() => setModalHist(null)} title={`📋 Histórico — ${modalHist?.produto}`}
        footer={<button className="btn btn-ghost" onClick={() => setModalHist(null)}>Fechar</button>}>
        {modalHist && (
          histDoItem.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--cinza)' }}>Nenhuma movimentação registrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {histDoItem.map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--creme)', borderRadius: 9, border: '1px solid var(--borda)' }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{h.tipo === 'entrada' ? '📥' : h.tipo === 'saida' ? '📤' : h.tipo === 'cadastro' ? '➕' : h.tipo === 'edicao' ? '✏️' : '🗑'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TIPO_COR[h.tipo] || 'var(--cinza)' }}>{TIPO_LABEL[h.tipo] || h.tipo}</span>
                      {h.quantidade > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: h.tipo === 'entrada' || h.tipo === 'cadastro' ? 'var(--verde)' : 'var(--laranja)' }}>{h.tipo === 'entrada' || h.tipo === 'cadastro' ? '+' : '−'}{h.quantidade}</span>}
                    </div>
                    {h.motivo && <div style={{ fontSize: 12.5, color: 'var(--cinza-medio)', marginTop: 2 }}>{h.motivo}</div>}
                    {h.qtd_antes != null && <div style={{ fontSize: 12, color: 'var(--cinza)', marginTop: 2 }}>Estoque: {h.qtd_antes} → {h.qtd_depois}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--cinza)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>👤 {h.usuario_nome || 'Sistema'}</span>
                      <span>{new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Modal>
    </div>
  )
}
