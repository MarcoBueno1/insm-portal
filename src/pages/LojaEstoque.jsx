import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import SelectCadastravel from '../components/SelectCadastravel'

const EMPTY = { nome: '', descricao: '', categoria: '', preco: '', qtd_atual: '', qtd_minima: '', unidade: 'un', ativo: true }

const st = (qtd, min) => qtd <= 0 ? 'critico' : qtd <= min ? 'baixo' : 'ok'
const ST = {
  ok:      { bg: 'var(--verde-bg)',    cor: 'var(--verde)',    ic: '✅ OK' },
  baixo:   { bg: 'var(--laran-bg)',    cor: 'var(--laranja)',  ic: '⚠️ Baixo' },
  critico: { bg: 'var(--vermelho-bg)', cor: 'var(--vermelho)', ic: '🔴 Crítico' },
}

const TIPO_LABEL = { entrada: '📥 Entrada', saida: '📤 Saída', cadastro: '➕ Cadastro', edicao: '✏️ Edição' }
const TIPO_COR   = { entrada: 'var(--verde)', saida: 'var(--laranja)', cadastro: 'var(--azul-claro)', edicao: 'var(--cinza)' }

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function LojaEstoque() {
  const { isCoord, nomeUser, user } = useAuth()
  const toast = useToast()

  const [lista, setLista]         = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('estoque')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMov, setModalMov]   = useState(null)
  const [modalHist, setModalHist] = useState(null)
  const [editando, setEditando]   = useState(null)
  const [saving, setSaving]       = useState(false)

  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca]   = useState('')
  const [ordem, setOrdem]   = useState('alfabetica')

  const [form, setForm] = useState(EMPTY)
  const [mov, setMov]   = useState({ tipo: 'entrada', quantidade: '', motivo: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [prodRes, movRes] = await Promise.all([
      supabase.from('loja_produtos').select('*').order('nome'),
      supabase.from('loja_movimentacoes')
        .select('*, loja_produtos(nome)')
        .order('criado_em', { ascending: false }).limit(50),
    ])
    setLista(prodRes.data || [])
    setHistorico(movRes.data || [])
    setLoading(false)
  }

  function abrirNovo() {
    setForm(EMPTY); setEditando(null); setModalOpen(true)
  }

  function abrirEditar(item) {
    setForm({
      nome: item.nome, descricao: item.descricao || '',
      categoria: item.categoria || '', preco: item.preco,
      qtd_atual: item.qtd_atual, qtd_minima: item.qtd_minima,
      unidade: item.unidade || 'un', ativo: item.ativo,
    })
    setEditando(item.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { toast('Informe o nome do produto.', 'error'); return }
    if (form.preco === '' || isNaN(parseFloat(form.preco))) { toast('Informe o preço.', 'error'); return }
    setSaving(true)
    const payload = {
      nome: form.nome.trim(), descricao: form.descricao || null,
      categoria: form.categoria || 'Outros',
      preco: parseFloat(form.preco) || 0,
      qtd_atual: parseFloat(form.qtd_atual) || 0,
      qtd_minima: parseFloat(form.qtd_minima) || 0,
      unidade: form.unidade || 'un',
      ativo: form.ativo !== false,
    }
    let error
    if (editando) {
      ;({ error } = await supabase.from('loja_produtos')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', editando))
      if (!error) {
        await supabase.from('loja_movimentacoes').insert({
          produto_id: editando, tipo: 'edicao', quantidade: 0,
          motivo: `Edição por ${nomeUser}`, usuario_nome: nomeUser, usuario_id: user?.id,
        })
      }
    } else {
      const res = await supabase.from('loja_produtos').insert({ ...payload, criado_por: user?.id }).select('id').single()
      error = res.error
      if (!error) {
        await supabase.from('loja_movimentacoes').insert({
          produto_id: res.data.id, tipo: 'cadastro',
          quantidade: parseFloat(form.qtd_atual) || 0,
          motivo: `Cadastrado por ${nomeUser}`, usuario_nome: nomeUser, usuario_id: user?.id,
          qtd_antes: 0, qtd_depois: parseFloat(form.qtd_atual) || 0,
        })
      }
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Produto atualizado!' : '✅ Produto cadastrado!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function registrarMov() {
    if (!mov.quantidade || parseFloat(mov.quantidade) <= 0) { toast('Informe a quantidade.', 'error'); return }
    setSaving(true)
    const item = modalMov
    const delta = mov.tipo === 'entrada' ? parseFloat(mov.quantidade) : -parseFloat(mov.quantidade)
    const novaQtd = Math.max(0, item.qtd_atual + delta)
    const { error } = await supabase.from('loja_produtos')
      .update({ qtd_atual: novaQtd, atualizado_em: new Date().toISOString() })
      .eq('id', item.id)
    if (!error) {
      await supabase.from('loja_movimentacoes').insert({
        produto_id: item.id, tipo: mov.tipo,
        quantidade: parseFloat(mov.quantidade),
        motivo: mov.motivo || `${mov.tipo === 'entrada' ? 'Entrada' : 'Saída'} por ${nomeUser}`,
        usuario_nome: nomeUser, usuario_id: user?.id,
        qtd_antes: item.qtd_atual, qtd_depois: novaQtd,
      })
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast('Movimentação registrada!'); setModalMov(null); load() }
    setSaving(false)
  }

  async function remover(id, nome) {
    if (!confirm(`Remover "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('loja_produtos').delete().eq('id', id)
    if (error) toast('Não foi possível remover (pode ter itens vinculados a pedidos).', 'error')
    else { toast('Produto removido.'); load() }
  }

  // Filtros
  const listaFiltrada = lista
    .filter(e => {
      const sBusca = e.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (e.categoria || '').toLowerCase().includes(busca.toLowerCase())
      const sStatus = filtro === 'todos' ? true : st(e.qtd_atual, e.qtd_minima) === filtro
      return sBusca && sStatus
    })
    .sort((a, b) => {
      if (ordem === 'criticidade') {
        const ord = { critico: 0, baixo: 1, ok: 2 }
        return ord[st(a.qtd_atual, a.qtd_minima)] - ord[st(b.qtd_atual, b.qtd_minima)]
      }
      return a.nome.localeCompare(b.nome)
    })

  // Histórico do item selecionado no modal
  const histDoItem = modalHist ? historico.filter(h => h.produto_id === modalHist.id) : []

  // Stats
  const criticos   = lista.filter(e => e.qtd_atual <= 0).length
  const baixos     = lista.filter(e => e.qtd_atual > 0 && e.qtd_atual <= e.qtd_minima).length
  const valorTotal = lista.reduce((s, e) => s + (e.qtd_atual * e.preco), 0)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Estoque da Loja</h1>
          <p className="page-subtitle">Produtos disponíveis para venda — separado do estoque geral</p>
        </div>
        <div className="page-actions">
          {isCoord && (
            <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Produto</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Carregando...</span></div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }} className="stat-grid-4">
            <div className="stat-card blue">
              <span className="stat-icon">📦</span>
              <div className="stat-value">{lista.length}</div>
              <div className="stat-label">Produtos</div>
            </div>
            <div className="stat-card orange">
              <span className="stat-icon">⚠️</span>
              <div className="stat-value" style={{ color: criticos > 0 ? 'var(--vermelho)' : baixos > 0 ? 'var(--laranja)' : 'var(--verde)' }}>
                {criticos + baixos}
              </div>
              <div className="stat-label">Alertas de estoque</div>
            </div>
            <div className="stat-card green">
              <span className="stat-icon">✅</span>
              <div className="stat-value">{lista.length - criticos - baixos}</div>
              <div className="stat-label">Itens OK</div>
            </div>
            <div className="stat-card gold">
              <span className="stat-icon">💰</span>
              <div className="stat-value" style={{ fontSize: 22 }}>{fmt(valorTotal)}</div>
              <div className="stat-label">Valor em estoque</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginBottom: 18 }}>
            <div className="tabs">
              {[['estoque', '📦 Estoque'], ['historico', '📋 Histórico']].map(([v, l]) => (
                <button key={v} className={`tab${tab === v ? ' active' : ''}`} onClick={() => setTab(v)}>{l}</button>
              ))}
            </div>
          </div>

          {tab === 'estoque' && (
            <>
              {/* Alertas */}
              {(criticos > 0 || baixos > 0) && (
                <div className={`alert ${criticos > 0 ? 'alert-red' : 'alert-gold'}`} style={{ marginBottom: 16 }}>
                  <span className="alert-icon">{criticos > 0 ? '🔴' : '⚠️'}</span>
                  <div>
                    {criticos > 0 && <><strong>{criticos} produto(s)</strong> com estoque zerado precisam de reposição urgente.<br /></>}
                    {baixos > 0 && <><strong>{baixos} produto(s)</strong> com estoque abaixo do mínimo.</>}
                  </div>
                </div>
              )}

              {/* Filtros */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="search-wrap" style={{ flex: 1 }}>
                  <span className="search-icon">🔍</span>
                  <input placeholder="Buscar produto ou categoria..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <select className="form-select" style={{ width: 170 }} value={filtro} onChange={e => setFiltro(e.target.value)}>
                  <option value="todos">Todos os status</option>
                  <option value="ok">✅ OK</option>
                  <option value="baixo">⚠️ Baixo</option>
                  <option value="critico">🔴 Crítico</option>
                </select>
                <select className="form-select" style={{ width: 190 }} value={ordem} onChange={e => setOrdem(e.target.value)}>
                  <option value="alfabetica">A → Z</option>
                  <option value="criticidade">Por criticidade</option>
                </select>
              </div>

              {listaFiltrada.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📦</span>
                  <h3>Nenhum produto encontrado</h3>
                  <p>Tente ajustar os filtros ou cadastre um novo produto.</p>
                  {isCoord && <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Produto</button>}
                </div>
              ) : (
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Categoria</th>
                          <th style={{ textAlign: 'right' }}>Preço</th>
                          <th style={{ textAlign: 'center' }}>Qtd Atual</th>
                          <th style={{ textAlign: 'center' }}>Mínimo</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th style={{ textAlign: 'center' }}>Atualizado</th>
                          {isCoord && <th style={{ textAlign: 'center' }}>Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {listaFiltrada.map(e => {
                          const si = ST[st(e.qtd_atual, e.qtd_minima)]
                          return (
                            <tr key={e.id}>
                              <td>
                                <strong style={{ fontSize: 13 }}>{e.nome}</strong>
                                {e.descricao && <div style={{ fontSize: 11.5, color: 'var(--cinza)', marginTop: 2 }}>{e.descricao}</div>}
                                {!e.ativo && <span style={{ fontSize: 10.5, color: 'var(--cinza)', marginLeft: 4 }}>(inativo)</span>}
                              </td>
                              <td style={{ fontSize: 12.5, color: 'var(--cinza-medio)' }}>{e.categoria || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--azul)' }}>{fmt(e.preco)}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{e.qtd_atual} <span style={{ fontSize: 11, color: 'var(--cinza)' }}>{e.unidade}</span></td>
                              <td style={{ textAlign: 'center', color: 'var(--cinza-medio)' }}>{e.qtd_minima} <span style={{ fontSize: 11 }}>{e.unidade}</span></td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: si.bg, color: si.cor }}>{si.ic}</span>
                              </td>
                              <td style={{ fontSize: 11.5, color: 'var(--cinza)', textAlign: 'center' }}>
                                {e.atualizado_em ? new Date(e.atualizado_em).toLocaleDateString('pt-BR') : '—'}
                              </td>
                              {isCoord && (
                                <td>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                    <button className="btn btn-sm btn-success" title="Movimentar"
                                      onClick={() => { setModalMov(e); setMov({ tipo: 'entrada', quantidade: '', motivo: '' }) }}>
                                      📥📤
                                    </button>
                                    <button className="btn btn-sm btn-ghost" title="Histórico" onClick={() => setModalHist(e)}>📋</button>
                                    <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(e)}>✏️</button>
                                    <button className="btn btn-sm btn-danger" onClick={() => remover(e.id, e.nome)}>🗑</button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'historico' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 Histórico de Movimentações</span>
                <span style={{ fontSize: 12, color: 'var(--cinza)' }}>Últimas 50 ações</span>
              </div>
              {historico.length === 0 ? (
                <div className="empty-state"><span className="empty-icon">📋</span><h3>Nenhuma movimentação</h3></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Data/Hora</th><th>Produto</th><th>Tipo</th><th style={{ textAlign: 'center' }}>Qtd</th><th>Antes → Depois</th><th>Motivo</th><th>Responsável</th></tr>
                    </thead>
                    <tbody>
                      {historico.map(h => (
                        <tr key={h.id}>
                          <td style={{ fontSize: 11.5, color: 'var(--cinza)', whiteSpace: 'nowrap' }}>
                            {new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td><strong style={{ fontSize: 13 }}>{h.loja_produtos?.nome || '—'}</strong></td>
                          <td><span style={{ fontSize: 11.5, fontWeight: 700, color: TIPO_COR[h.tipo] || 'var(--cinza)' }}>{TIPO_LABEL[h.tipo] || h.tipo}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: h.tipo === 'entrada' || h.tipo === 'cadastro' ? 'var(--verde)' : 'var(--laranja)' }}>
                            {h.quantidade > 0 ? `${h.tipo === 'entrada' || h.tipo === 'cadastro' ? '+' : '−'}${h.quantidade}` : '—'}
                          </td>
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
        </>
      )}

      {/* ── Modal: Cadastro / Edição ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Produto' : '📦 Novo Produto da Loja'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? '⏳...' : 'Salvar'}</button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">Nome do produto *</label>
          <input className="form-input" placeholder="Ex: Camiseta INSM Tamanho M" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input className="form-input" placeholder="Descrição breve (opcional)" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <SelectCadastravel categoria="categorias_loja" value={form.categoria} onChange={v => setForm(f => ({ ...f, categoria: v }))} placeholder="Selecione..." />
          </div>
          <div className="form-group">
            <label className="form-label">Preço de venda (R$) *</label>
            <input className="form-input" type="number" step="0.01" min="0" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Qtd Atual</label>
            <input className="form-input" type="number" min="0" step="1" placeholder="0" value={form.qtd_atual} onChange={e => setForm(f => ({ ...f, qtd_atual: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Qtd Mínima</label>
            <input className="form-input" type="number" min="0" step="1" placeholder="5" value={form.qtd_minima} onChange={e => setForm(f => ({ ...f, qtd_minima: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Unidade</label>
            <SelectCadastravel categoria="unidades_loja" value={form.unidade} onChange={v => setForm(f => ({ ...f, unidade: v }))} placeholder="un" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input type="checkbox" id="ativo" checked={form.ativo !== false}
            onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
          <label htmlFor="ativo" style={{ fontSize: 13, color: 'var(--texto)', cursor: 'pointer' }}>Produto ativo (aparece nas comandas)</label>
        </div>
      </Modal>

      {/* ── Modal: Movimentação ── */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)}
        title={`📦 Movimentar — ${modalMov?.nome}`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalMov(null)}>Cancelar</button>
            <button className={`btn ${mov.tipo === 'entrada' ? 'btn-success' : 'btn-danger'}`} onClick={registrarMov} disabled={saving}>
              {saving ? '⏳...' : mov.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}
            </button>
          </>
        }>
        {modalMov && (
          <>
            <div className="alert alert-blue" style={{ marginBottom: 14 }}>
              <span className="alert-icon">📦</span>
              <div>Quantidade atual: <strong style={{ fontSize: 16 }}>{modalMov.qtd_atual} {modalMov.unidade}</strong></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['entrada', '📥 Entrada', 'var(--verde)'], ['saida', '📤 Saída', 'var(--vermelho)']].map(([v, l, c]) => (
                <button key={v} onClick={() => setMov(m => ({ ...m, tipo: v }))}
                  style={{ padding: 12, border: `2px solid ${mov.tipo === v ? c : 'var(--borda)'}`, borderRadius: 10, background: mov.tipo === v ? `${c}18` : 'white', cursor: 'pointer', fontWeight: 700, color: mov.tipo === v ? c : 'var(--cinza-medio)', fontSize: 13.5, transition: 'all .15s', fontFamily: 'var(--font-body)' }}>
                  {l}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Quantidade *</label>
              <input className="form-input" type="number" min="1" step="1" placeholder="Ex: 10" value={mov.quantidade} onChange={e => setMov(m => ({ ...m, quantidade: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Motivo / Observação</label>
              <input className="form-input" placeholder="Ex: Compra de fornecedor, devolução..." value={mov.motivo} onChange={e => setMov(m => ({ ...m, motivo: e.target.value }))} />
            </div>
            {mov.quantidade && (
              <div className="alert alert-gold">
                <span className="alert-icon">ℹ️</span>
                <div>
                  Nova quantidade: <strong>{Math.max(0, modalMov.qtd_atual + (mov.tipo === 'entrada' ? 1 : -1) * parseFloat(mov.quantidade || 0))} {modalMov.unidade}</strong>
                  <br /><span style={{ fontSize: 11.5 }}>Registrado por: <strong>{nomeUser}</strong></span>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Histórico do item ── */}
      <Modal open={!!modalHist} onClose={() => setModalHist(null)}
        title={`📋 Histórico — ${modalHist?.nome}`}
        footer={<button className="btn btn-ghost" onClick={() => setModalHist(null)}>Fechar</button>}>
        {modalHist && (
          histDoItem.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--cinza)' }}>Nenhuma movimentação registrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {histDoItem.map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--creme)', borderRadius: 9, border: '1px solid var(--borda)' }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>
                    {h.tipo === 'entrada' ? '📥' : h.tipo === 'saida' ? '📤' : h.tipo === 'cadastro' ? '➕' : '✏️'}
                  </div>
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
